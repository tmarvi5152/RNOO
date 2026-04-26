import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService } from "../../context/AppContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
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
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Search, Building2 } from "lucide-react";

const AdminResellersPage = () => {
  useAuth();
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
    company_name: "",
    is_active: true,
  });

  useEffect(() => {
    loadResellers();
  }, []);

  const loadResellers = async () => {
    try {
      setLoading(true);
      const res = await apiService.getResellers();
      setResellers(res.data || []);
    } catch (error) {
      toast.error("Failed to load resellers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.contact_email) {
      toast.error("Name and email are required");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.createReseller(formData);
      setResellers((prev) => [...prev, res]);
      toast.success("Reseller created successfully");
      setFormData({
        name: "",
        contact_email: "",
        contact_phone: "",
        company_name: "",
        is_active: true,
      });
      setIsCreateOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to create reseller");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reseller) => {
    setEditingReseller(reseller);
    setFormData({
      name: reseller.name,
      contact_email: reseller.contact_email,
      contact_phone: reseller.contact_phone || "",
      company_name: reseller.company_name || "",
      is_active: reseller.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!formData.name || !formData.contact_email) {
      toast.error("Name and email are required");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.updateReseller(editingReseller.id, formData);
      setResellers((prev) =>
        prev.map((r) => (r.id === editingReseller.id ? res : r)),
      );
      toast.success("Reseller updated successfully");
      setIsEditOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to update reseller");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this reseller?"))
      return;

    try {
      await apiService.deleteReseller(id);
      setResellers((prev) => prev.filter((r) => r.id !== id));
      toast.success("Reseller deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete reseller");
    }
  };

  const filteredResellers = resellers.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contact_email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Resellers Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage reseller accounts and information
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#cc0000] hover:bg-[#a90000]">
                <Plus className="w-4 h-4 mr-2" />
                New Reseller
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Reseller</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    name="name"
                    placeholder="Company name"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label>Contact Email *</Label>
                  <Input
                    name="contact_email"
                    type="email"
                    placeholder="email@company.com"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    name="contact_phone"
                    placeholder="+1 (555) 000-0000"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label>Legal Company Name</Label>
                  <Input
                    name="company_name"
                    placeholder="Legal company name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <Label>Active</Label>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={saving}
                  className="w-full bg-[#cc0000] hover:bg-[#a90000]"
                >
                  {saving ? "Creating..." : "Create Reseller"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Resellers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Resellers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : filteredResellers.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No resellers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Contact Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Merchants</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResellers.map((reseller) => (
                      <TableRow key={reseller.id}>
                        <TableCell className="font-medium">
                          {reseller.name}
                        </TableCell>
                        <TableCell>{reseller.contact_email}</TableCell>
                        <TableCell>{reseller.contact_phone || "-"}</TableCell>
                        <TableCell>{reseller.merchant_count || 0}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              reseller.is_active
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-100 border-0"
                            }
                          >
                            {reseller.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(reseller.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(reseller)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(reseller.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Reseller</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Company Name *</Label>
                <Input
                  name="name"
                  placeholder="Company name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label>Contact Email *</Label>
                <Input
                  name="contact_email"
                  type="email"
                  placeholder="email@company.com"
                  value={formData.contact_email}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  name="contact_phone"
                  placeholder="+1 (555) 000-0000"
                  value={formData.contact_phone}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label>Legal Company Name</Label>
                <Input
                  name="company_name"
                  placeholder="Legal company name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <Label>Active</Label>
              </div>
              <Button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-full bg-[#cc0000] hover:bg-[#a90000]"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminResellersPage;
