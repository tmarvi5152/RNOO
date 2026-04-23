import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService, api } from "../../context/AppContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import {
  RefreshCw,
  Link2,
  Unlink,
  Server,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Download,
} from "lucide-react";

const ShepherdPage = () => {
  useAuth();
  const [shepherdMerchants, setShepherdMerchants] = useState([]);
  const [localMerchants, setLocalMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [syncingLicense, setSyncingLicense] = useState(null);
  const [linkingMerchant, setLinkingMerchant] = useState(null);
  const [selectedShepherdId, setSelectedShepherdId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Shepherd merchants
      const shepherdRes = await api.get("/shepherd/merchants");
      setShepherdMerchants(shepherdRes.data.merchants || []);

      // Load local merchants
      const localRes = await apiService.getMerchants();
      setLocalMerchants(localRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
      if (err.response?.status === 503) {
        setShepherdMerchants([]); // Set empty merchants
        // Load local merchants even if Shepherd fails
        try {
          const localRes = await apiService.getMerchants();
          setLocalMerchants(localRes.data);
        } catch (localErr) {
          console.error("Failed to load local merchants:", localErr);
        }
        toast.info(
          "Shepherd API not configured. Set SHEPHERD_BEARER_TOKEN in backend .env to enable POS integration.",
        );
      } else {
        toast.error("Failed to load Shepherd data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMenu = async (merchantId) => {
    setSyncing(merchantId);
    try {
      const res = await api.post(`/shepherd/sync-menu/${merchantId}`);
      toast.success(
        `Synced ${res.data.items_synced} items in ${res.data.categories_synced} categories (RNOO menus only)`,
      );
      loadData();
    } catch (err) {
      console.error("Failed to sync menu:", err);
      if (err.response?.status === 503) {
        toast.info(
          "Shepherd API not configured. Set SHEPHERD_BEARER_TOKEN in backend .env to enable menu syncing.",
        );
      } else {
        toast.error(err.response?.data?.detail || "Failed to sync menu");
      }
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncLicense = async (merchantId) => {
    setSyncingLicense(merchantId);
    try {
      const res = await api.post(`/shepherd/sync-license/${merchantId}`);
      const licenseName = res.data.license_info?.license_name;
      toast.success(
        licenseName
          ? `License info synced: ${licenseName}`
          : "License info synced from Shepherd",
      );
      loadData();
    } catch (err) {
      console.error("Failed to sync license:", err);
      if (err.response?.status === 503) {
        toast.info(
          "Shepherd API not configured. Set SHEPHERD_BEARER_TOKEN in backend .env to enable license syncing.",
        );
      } else {
        toast.error(
          err.response?.data?.detail || "Failed to sync license info",
        );
      }
    } finally {
      setSyncingLicense(null);
    }
  };

  const handleLinkMerchant = async () => {
    if (!linkingMerchant || !selectedShepherdId) {
      toast.error("Please select a Shepherd merchant");
      return;
    }

    try {
      const shepherdMerchant = shepherdMerchants.find(
        (m) => m.merchantId === selectedShepherdId,
      );

      await apiService.updateMerchant(linkingMerchant.id, {
        shepherd_config: {
          merchant_id: selectedShepherdId,
          clerk_id: "8888",
          location: shepherdMerchant?.location,
        },
      });

      toast.success("Merchant linked to Shepherd successfully");
      setLinkingMerchant(null);
      setSelectedShepherdId("");
      loadData();
    } catch (err) {
      console.error("Failed to link merchant:", err);
      toast.error("Failed to link merchant");
    }
  };

  const handleUnlinkMerchant = async (merchantId) => {
    try {
      await apiService.updateMerchant(merchantId, {
        shepherd_config: null,
      });
      toast.success("Merchant unlinked from Shepherd");
      loadData();
    } catch (err) {
      console.error("Failed to unlink merchant:", err);
      toast.error("Failed to unlink merchant");
    }
  };

  const getShepherdMerchantInfo = (shepherdId) => {
    return shepherdMerchants.find((m) => m.merchantId === shepherdId);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
              Shepherd Integration
            </h1>
            <p className="text-gray-500 mt-1">
              Connect merchants to RPOWER Shepherd for menu sync and order
              injection
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            data-testid="refresh-shepherd-btn"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Shepherd Merchants</p>
                  <p className="text-2xl font-bold">
                    {shepherdMerchants.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-semantic-success/10 flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-semantic-success" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Linked Merchants</p>
                  <p className="text-2xl font-bold">
                    {
                      localMerchants.filter(
                        (m) => m.shepherd_config?.merchant_id,
                      ).length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-semantic-warning/10 flex items-center justify-center">
                  <Database className="w-6 h-6 text-semantic-warning" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Local Merchants</p>
                  <p className="text-2xl font-bold">{localMerchants.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Local Merchants with Shepherd Status */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Local Merchants</CardTitle>
            <CardDescription>
              Link local merchants to Shepherd for menu synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Shepherd Link</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localMerchants.map((merchant) => {
                      const shepherdId = merchant.shepherd_config?.merchant_id;
                      const shepherdInfo = shepherdId
                        ? getShepherdMerchantInfo(shepherdId)
                        : null;
                      const isLinked = !!shepherdId;

                      return (
                        <TableRow
                          key={merchant.id}
                          data-testid={`merchant-row-${merchant.id}`}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{merchant.name}</p>
                              <p className="text-sm text-gray-500">
                                {merchant.city}, {merchant.state}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isLinked ? (
                              <div>
                                <p className="font-medium text-sm">
                                  {shepherdInfo?.location || shepherdId}
                                </p>
                                <p className="text-xs text-gray-500">
                                  ID: {shepherdId}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {formatDate(merchant.last_menu_sync)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isLinked ? (
                              <Badge className="bg-semantic-success/10 text-semantic-success">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Linked
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-gray-500"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Not Linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isLinked ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleSyncLicense(merchant.id)
                                    }
                                    disabled={syncingLicense === merchant.id}
                                    title="Sync license/store info from Shepherd"
                                    data-testid={`sync-license-btn-${merchant.id}`}
                                  >
                                    {syncingLicense === merchant.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                    <span className="ml-1 hidden sm:inline">
                                      Sync Info
                                    </span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSyncMenu(merchant.id)}
                                    disabled={syncing === merchant.id}
                                    title="Sync menu items from Shepherd (RNOO menus only)"
                                    data-testid={`sync-menu-btn-${merchant.id}`}
                                  >
                                    {syncing === merchant.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Download className="w-4 h-4" />
                                    )}
                                    <span className="ml-1 hidden sm:inline">
                                      Sync Menu
                                    </span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleUnlinkMerchant(merchant.id)
                                    }
                                    className="text-semantic-error hover:text-semantic-error"
                                  >
                                    <Unlink className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLinkingMerchant(merchant)}
                                  data-testid={`link-merchant-btn-${merchant.id}`}
                                >
                                  <Link2 className="w-4 h-4 mr-1" />
                                  Link
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {localMerchants.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-gray-500"
                        >
                          No merchants found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shepherd Merchants List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">
              Available Shepherd Merchants
            </CardTitle>
            <CardDescription>
              RPOWER POS locations available for integration
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shepherdMerchants.map((merchant) => (
                      <TableRow key={merchant.merchantId}>
                        <TableCell className="font-mono text-sm">
                          {merchant.merchantId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {merchant.location}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {merchant.version}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(merchant.lastDing)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {shepherdMerchants.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-gray-500"
                        >
                          No Shepherd merchants found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link Merchant Dialog */}
        <Dialog
          open={!!linkingMerchant}
          onOpenChange={() => setLinkingMerchant(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                Link to Shepherd
              </DialogTitle>
              <DialogDescription>
                Connect {linkingMerchant?.name} to a Shepherd merchant for menu
                sync
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>Select Shepherd Merchant</Label>
                <Select
                  value={selectedShepherdId}
                  onValueChange={setSelectedShepherdId}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a Shepherd merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {shepherdMerchants.map((m) => (
                      <SelectItem key={m.merchantId} value={m.merchantId}>
                        {m.location} ({m.merchantId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedShepherdId && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Selected Merchant</p>
                  <p className="font-medium">
                    {getShepherdMerchantInfo(selectedShepherdId)?.location}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ID: {selectedShepherdId}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLinkingMerchant(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary hover:bg-primary-hover"
                  onClick={handleLinkMerchant}
                  disabled={!selectedShepherdId}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Merchant
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default ShepherdPage;
