import { useEffect, useRef, useState, useCallback } from "react";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8765";
// Convert http(s) to ws(s) for WebSocket URL
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

/**
 * Custom hook for WebSocket connection to receive real-time order updates
 *
 * @param {Object} options - Configuration options
 * @param {string} options.merchantId - Merchant ID for merchant-specific updates (optional)
 * @param {boolean} options.isAdmin - Whether this is an admin connection (receives all orders)
 * @param {function} options.onNewOrder - Callback when new order is received
 * @param {function} options.onOrderUpdate - Callback when order status changes
 * @param {function} options.onConnect - Callback when WebSocket connects
 * @param {function} options.onDisconnect - Callback when WebSocket disconnects
 */
export const useOrderWebSocket = ({
  merchantId,
  isAdmin = false,
  onNewOrder,
  onOrderUpdate,
  onConnect,
  onDisconnect,
}) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isConnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket connection already in progress or connected");
      return;
    }

    isConnectingRef.current = true;
    // Determine WebSocket URL based on admin or merchant
    // Use /api/ws/ prefix to route through Kubernetes ingress to backend
    let wsUrl;
    if (isAdmin) {
      wsUrl = `${WS_URL}/api/ws/admin/orders`;
    } else if (merchantId) {
      wsUrl = `${WS_URL}/api/ws/orders/${merchantId}`;
    } else {
      console.warn(
        "No merchantId or admin flag provided for WebSocket connection",
      );
      isConnectingRef.current = false;
      return;
    }

    console.log("Connecting to WebSocket:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        isConnectingRef.current = false;
        setIsConnected(true);
        onConnect?.();

        // Setup ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          // Handle pong responses
          if (event.data === "pong") {
            return;
          }

          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Route message to appropriate callback
          if (data.type === "new_order") {
            console.log("New order received:", data.order?.id);
            onNewOrder?.(data.order, data);
          } else if (data.type?.startsWith("order_")) {
            console.log("Order update:", data.type, data.order?.id);
            onOrderUpdate?.(data.order, data.type, data);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt to reconnect after 5 seconds (unless intentionally closed)
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect WebSocket...");
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket connection:", err);
      isConnectingRef.current = false;
    }
  }, [merchantId, isAdmin, onNewOrder, onOrderUpdate, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional disconnect");
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    reconnect: connect,
    disconnect,
  };
};

export default useOrderWebSocket;
