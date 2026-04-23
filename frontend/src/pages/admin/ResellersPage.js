import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService } from "../../context/AppContext";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
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
  DialogTrigger,
} from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Search, Users, Store, Loader2 } from "lucide-react";

const ResellersPage = () => {
  useAuth();
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newReseller, setNewReseller] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
    company_name: "",
  });

  useEffect(() => {
    loadResellers();
  }, []);

  const loadResellers = async () => {
    try {
      setLoading(true);
      const res = await apiService.getResellers();
      setResellers(res.data);
    } catch (err) {
      console.error("Failed to load resellers:", err);
      toast.error("Failed to load resellers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReseller = async (e) => {
    e.preventDefault();

    if (!newReseller.name || !newReseller.contact_email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      await apiService.createReseller(newReseller);
      toast.success("Reseller created successfully");
      setIsCreateOpen(false);
      setNewReseller({
        name: "",
        contact_email: "",
        contact_phone: "",
        company_name: "",
      });
      loadResellers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create reseller");
    } finally {
      setCreating(false);
    }
  };

  const filteredResellers = resellers.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
              Resellers
            </h1>
            <p className="text-gray-500 mt-1">
              Manage channel partners and reseller accounts
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-primary hover:bg-primary-hover"
                data-testid="add-reseller-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Reseller
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">
                  Create New Reseller
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateReseller} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Reseller Name *</Label>
                  <Input
                    id="name"
                    value={newReseller.name}
                    onChange={(e) =>
                      setNewReseller({ ...newReseller, name: e.target.value })
                    }
                    placeholder="Partner Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={newReseller.company_name}
                    onChange={(e) =>
                      setNewReseller({
                        ...newReseller,
                        company_name: e.target.value,
                      })
                    }
                    placeholder="Company Inc."
                  />
                </div>
                <div>
                  <Label htmlFor="email">Contact Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newReseller.contact_email}
                    onChange={(e) =>
                      setNewReseller({
                        ...newReseller,
                        contact_email: e.target.value,
                      })
                    }
                    placeholder="contact@partner.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Contact Phone</Label>
                  <Input
                    id="phone"
                    value={newReseller.contact_phone}
                    onChange={(e) =>
                      setNewReseller({
                        ...newReseller,
                        contact_phone: e.target.value,
                      })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Reseller"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search resellers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-resellers-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Resellers Table */}
        <Card>
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
                      <TableHead>Reseller</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Merchants</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResellers.map((reseller) => (
                      <TableRow
                        key={reseller.id}
                        data-testid={`reseller-row-${reseller.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-primary" />
                            </div>
                            <p className="font-medium">{reseller.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {reseller.company_name || "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{reseller.contact_email}</p>
                            <p className="text-sm text-gray-500">
                              {reseller.contact_phone || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Store className="w-4 h-4 text-gray-400" />
                            <span>{reseller.merchant_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {reseller.is_active ? (
                            <Badge className="bg-semantic-success/10 text-semantic-success">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredResellers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-gray-500"
                        >
                          No resellers found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ResellersPage;
