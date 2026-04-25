import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../layouts/Layout";
import { apiService } from "../../context/AppContext";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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
} from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  FileText,
  Copy,
  CheckCircle,
  Download,
  ChevronsUpDown,
  Store,
} from "lucide-react";

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("all");
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);

  const merchantMap = useMemo(
    () => new Map(merchants.map((merchant) => [merchant.id, merchant])),
    [merchants],
  );

  const selectedMerchant =
    selectedMerchantId !== "all" ? merchantMap.get(selectedMerchantId) : null;

  const loadMerchants = useCallback(async () => {
    try {
      const res = await apiService.getMerchants();
      setMerchants(res.data || []);
    } catch (err) {
      console.error("Failed to load merchants:", err);
      toast.error("Failed to load merchants");
    }
  }, []);

  const loadLogs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = {
          limit: pageSize,
          skip: (page - 1) * pageSize,
        };

        if (selectedMerchantId !== "all") {
          params.merchant_id = selectedMerchantId;
        }

        const res = await apiService.getLogs(params);

        // Handle new pagination response format
        let logsData = res.data;
        let paginationData = null;

        if (res.data.logs && res.data.pagination) {
          // New paginated response
          logsData = res.data.logs;
          paginationData = res.data.pagination;
        } else {
          // Fallback for old response format
          logsData = res.data;
        }

        setLogs(logsData);
        setPagination(paginationData);
      } catch (err) {
        console.error("Failed to load logs:", err);
        toast.error("Failed to load logs");
      } finally {
        setLoading(false);
      }
    },
    [pageSize, selectedMerchantId],
  );

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  useEffect(() => {
    loadLogs(currentPage);
  }, [currentPage, loadLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, selectedMerchantId]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const merchantName = merchantMap.get(log.merchant_id)?.name || "";
        const normalizedSearchTerm = searchTerm.toLowerCase();

        const searchMatch =
          !searchTerm ||
          log.action?.toLowerCase().includes(normalizedSearchTerm) ||
          log.endpoint?.toLowerCase().includes(normalizedSearchTerm) ||
          log.merchant_id?.toLowerCase().includes(normalizedSearchTerm) ||
          merchantName.toLowerCase().includes(normalizedSearchTerm) ||
          log.user_email?.toLowerCase().includes(normalizedSearchTerm) ||
          log.user_id?.toLowerCase().includes(normalizedSearchTerm);

        const actionMatch =
          actionFilter === "all" || log.action === actionFilter;

        let statusMatch = true;
        if (statusFilter === "success")
          statusMatch = log.status_code >= 200 && log.status_code < 300;
        else if (statusFilter === "client-error")
          statusMatch = log.status_code >= 400 && log.status_code < 500;
        else if (statusFilter === "server-error")
          statusMatch = log.status_code >= 500;

        const logDate = new Date(log.created_at);
        const dateFromMatch = !dateFrom || logDate >= new Date(dateFrom);
        const dateToMatch =
          !dateTo || logDate <= new Date(`${dateTo}T23:59:59`);
        const userEmailMatch =
          !userEmailFilter ||
          log.user_email?.toLowerCase().includes(userEmailFilter.toLowerCase());
        const merchantMatch =
          selectedMerchantId === "all" ||
          log.merchant_id === selectedMerchantId;

        return (
          searchMatch &&
          actionMatch &&
          statusMatch &&
          dateFromMatch &&
          dateToMatch &&
          userEmailMatch &&
          merchantMatch
        );
      }),
    [
      logs,
      merchantMap,
      searchTerm,
      actionFilter,
      statusFilter,
      dateFrom,
      dateTo,
      userEmailFilter,
      selectedMerchantId,
    ],
  );

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatFullDate = (dateStr) => {
    return new Date(dateStr).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const getStatusColor = (code) => {
    if (code >= 200 && code < 300)
      return "bg-semantic-success/10 text-semantic-success";
    if (code >= 400 && code < 500)
      return "bg-semantic-warning/10 text-semantic-warning";
    if (code >= 500) return "bg-semantic-error/10 text-semantic-error";
    return "bg-gray-100 text-gray-600";
  };

  const getActionColor = (action) => {
    if (action?.includes("created") || action?.includes("success"))
      return "text-green-600";
    if (
      action?.includes("deleted") ||
      action?.includes("failed") ||
      action?.includes("error")
    )
      return "text-red-600";
    if (action?.includes("updated") || action?.includes("sync"))
      return "text-blue-600";
    return "text-gray-700";
  };

  const uniqueActions = useMemo(() => {
    const actions = new Set();
    logs.forEach((log) => {
      if (log.action) actions.add(log.action);
    });
    return Array.from(actions).sort();
  }, [logs]);

  const getMerchantLabel = (merchantId) => {
    if (!merchantId) return "N/A";
    return merchantMap.get(merchantId)?.name || merchantId;
  };

  const handleCopyJson = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleExportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    try {
      // Prepare CSV headers
      const headers = [
        "Timestamp",
        "Action",
        "Endpoint",
        "Status",
        "User Email",
        "Merchant",
        "Merchant ID",
      ];

      // Prepare CSV rows
      const rows = filteredLogs.map((log) => [
        formatFullDate(log.created_at),
        log.action?.replace(/_/g, " ") || "N/A",
        log.endpoint || "N/A",
        log.status_code || "N/A",
        log.user_email || "N/A",
        getMerchantLabel(log.merchant_id),
        log.merchant_id || "N/A",
      ]);

      // Create CSV content
      const csvContent = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download CSV
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent),
      );
      element.setAttribute(
        "download",
        `logs_${new Date().toISOString().split("T")[0]}.csv`,
      );
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success(`Exported ${filteredLogs.length} log(s) to CSV`);
    } catch (err) {
      console.error("Failed to export logs:", err);
      toast.error("Failed to export logs");
    }
  };

  const renderJsonData = (data, label) => {
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return (
        <div className="text-gray-400 text-sm italic">
          No {label.toLowerCase()}
        </div>
      );
    }
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0"
          onClick={() => handleCopyJson(data)}
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
              Audit Logs
            </h1>
            <p className="text-gray-500 mt-1">
              Track system activity and API calls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadLogs}
              disabled={loading}
              data-testid="refresh-logs-btn"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExportToCSV}
              disabled={loading || filteredLogs.length === 0}
              data-testid="export-logs-btn"
              title="Export filtered logs to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* First row: Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by action, endpoint, merchant ID, or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-logs-input"
                />
              </div>

              {/* Second row: Action, Status, and User Email */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Popover
                  open={merchantPickerOpen}
                  onOpenChange={setMerchantPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={merchantPickerOpen}
                      className="w-full sm:w-72 justify-between"
                    >
                      <span className="truncate">
                        {selectedMerchant
                          ? selectedMerchant.name
                          : "All merchants"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search merchants by name..." />
                      <CommandList>
                        <CommandEmpty>No merchants found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all merchants"
                            onSelect={() => {
                              setSelectedMerchantId("all");
                              setMerchantPickerOpen(false);
                            }}
                          >
                            <Store className="w-4 h-4" />
                            All merchants
                          </CommandItem>
                          {merchants.map((merchant) => (
                            <CommandItem
                              key={merchant.id}
                              value={`${merchant.name} ${merchant.id}`}
                              onSelect={() => {
                                setSelectedMerchantId(merchant.id);
                                setMerchantPickerOpen(false);
                              }}
                            >
                              <Store className="w-4 h-4" />
                              <div className="flex flex-col">
                                <span>{merchant.name}</span>
                                <span className="text-xs text-gray-500">
                                  {merchant.id}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success (2xx)</SelectItem>
                    <SelectItem value="client-error">
                      Client Error (4xx)
                    </SelectItem>
                    <SelectItem value="server-error">
                      Server Error (5xx)
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Filter by user email..."
                  value={userEmailFilter}
                  onChange={(e) => setUserEmailFilter(e.target.value)}
                  className="w-full sm:flex-1"
                />
              </div>

              {/* Third row: Date Range */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-48"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-48"
                />
                {(selectedMerchantId !== "all" ||
                  searchTerm ||
                  actionFilter !== "all" ||
                  statusFilter !== "all" ||
                  userEmailFilter ||
                  dateFrom ||
                  dateTo) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedMerchantId("all");
                      setSearchTerm("");
                      setActionFilter("all");
                      setStatusFilter("all");
                      setUserEmailFilter("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="w-full sm:w-auto"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Active filters summary */}
              {(selectedMerchantId !== "all" ||
                searchTerm ||
                actionFilter !== "all" ||
                statusFilter !== "all" ||
                userEmailFilter ||
                dateFrom ||
                dateTo) && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  <span className="font-medium">Active filters:</span>
                  {selectedMerchant && (
                    <Badge className="ml-2">
                      Merchant: {selectedMerchant.name}
                    </Badge>
                  )}
                  {searchTerm && (
                    <Badge className="ml-2">Search: {searchTerm}</Badge>
                  )}
                  {actionFilter !== "all" && (
                    <Badge className="ml-2">Action: {actionFilter}</Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge className="ml-2">Status: {statusFilter}</Badge>
                  )}
                  {userEmailFilter && (
                    <Badge className="ml-2">Email: {userEmailFilter}</Badge>
                  )}
                  {dateFrom && (
                    <Badge className="ml-2">
                      From: {new Date(dateFrom).toLocaleDateString()}
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge className="ml-2">
                      To: {new Date(dateTo).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        data-testid={`log-row-${log.id}`}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span
                              className={`font-medium ${getActionColor(log.action)}`}
                            >
                              {log.action?.replace(/_/g, " ")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {log.endpoint}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(log.status_code)}>
                            {log.status_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {getMerchantLabel(log.merchant_id)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {log.user_email ? (
                            <span className="text-xs">{log.user_email}</span>
                          ) : log.user_id ? (
                            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                              {log.user_id.substring(0, 8)}...
                            </code>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          No logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.total > pageSize && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, pagination.total)} of{" "}
                    {pagination.total} logs
                  </div>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => setPageSize(parseInt(value))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((prev) => prev - 1);
                      loadLogs(currentPage - 1);
                    }}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from(
                      {
                        length: Math.min(
                          5,
                          Math.ceil(pagination.total / pageSize),
                        ),
                      },
                      (_, i) => {
                        const pageNum =
                          Math.max(
                            1,
                            Math.min(
                              Math.ceil(pagination.total / pageSize) - 4,
                              currentPage - 2,
                            ),
                          ) + i;
                        if (pageNum > Math.ceil(pagination.total / pageSize))
                          return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={
                              pageNum === currentPage ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => {
                              setCurrentPage(pageNum);
                              loadLogs(pageNum);
                            }}
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((prev) => prev + 1);
                      loadLogs(currentPage + 1);
                    }}
                    disabled={!pagination.has_more}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log Detail Modal */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Log Details
              </DialogTitle>
            </DialogHeader>

            {selectedLog && (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Timestamp
                      </label>
                      <p className="mt-1">
                        {formatFullDate(selectedLog.created_at)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Status Code
                      </label>
                      <div className="mt-1">
                        <Badge
                          className={getStatusColor(selectedLog.status_code)}
                        >
                          {selectedLog.status_code}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Action
                    </label>
                    <p
                      className={`mt-1 font-medium ${getActionColor(selectedLog.action)}`}
                    >
                      {selectedLog.action?.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Endpoint
                    </label>
                    <code className="block mt-1 text-sm bg-gray-100 px-3 py-2 rounded">
                      {selectedLog.endpoint}
                    </code>
                  </div>

                  {/* User Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        User
                      </label>
                      <p className="mt-1 text-sm">
                        {selectedLog.user_email || (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </p>
                      {selectedLog.user_role && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {selectedLog.user_role}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Merchant
                      </label>
                      <p className="mt-1 text-sm">
                        {selectedLog.merchant_id ? (
                          getMerchantLabel(selectedLog.merchant_id)
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </p>
                      {selectedLog.merchant_id && (
                        <p className="mt-1 font-mono text-xs text-gray-500">
                          {selectedLog.merchant_id}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedLog.user_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        User ID
                      </label>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {selectedLog.user_id}
                      </p>
                    </div>
                  )}

                  {selectedLog.ip_address && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        IP Address
                      </label>
                      <p className="mt-1 font-mono text-sm">
                        {selectedLog.ip_address}
                      </p>
                    </div>
                  )}

                  {/* Request Data */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 block mb-2">
                      Request Data
                    </label>
                    {renderJsonData(selectedLog.request_data, "Request Data")}
                  </div>

                  {/* Response Data */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 block mb-2">
                      Response Data
                    </label>
                    {renderJsonData(selectedLog.response_data, "Response Data")}
                  </div>

                  {/* Log ID */}
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium text-gray-500">
                      Log ID
                    </label>
                    <code className="block mt-1 text-xs text-gray-400">
                      {selectedLog.id}
                    </code>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default LogsPage;
