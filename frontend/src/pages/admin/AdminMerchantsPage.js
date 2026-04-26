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
import { Textarea } from "../../components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Search, Store, MapPin } from "lucide-react";

const AdminMerchantsPage = () => {
  useAuth();
  const [merchants, setMerchants] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    reseller_id: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    email: "",
    description: "",
    price_bump_percentage: 0,
    price_bump_fixed: 0,
    is_active: true,
    is_open: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [merchantsRes, resellersRes] = await Promise.all([
        apiService.getMerchants(),
        apiService.getResellers(),
      ]);
      setMerchants(merchantsRes || []);
      setResellers(resellersRes || []);
    } catch (error) {
      toast.error("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "price_bump_percentage" || name === "price_bump_fixed"
            ? parseFloat(value) || 0
            : value,
    }));
  };

  const handleCreate = async () => {
    if (
      !formData.name ||
      !formData.slug ||
      !formData.reseller_id ||
      !formData.email
    ) {
      toast.error("Name, slug, reseller, and email are required");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.createMerchant(formData);
      setMerchants((prev) => [...prev, res]);
      toast.success("Merchant created successfully");
      resetForm();
      setIsCreateOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to create merchant");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      name: merchant.name,
      slug: merchant.slug,
      reseller_id: merchant.reseller_id,
      address_line1: merchant.address_line1,
      address_line2: merchant.address_line2 || "",
      city: merchant.city,
      state: merchant.state,
      zip_code: merchant.zip_code,
      phone: merchant.phone,
      email: merchant.email,
      description: merchant.description || "",
      price_bump_percentage: merchant.price_bump_percentage || 0,
      price_bump_fixed: merchant.price_bump_fixed || 0,
      is_active: merchant.is_active,
      is_open: merchant.is_open,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (
      !formData.name ||
      !formData.slug ||
      !formData.reseller_id ||
      !formData.email
    ) {
      toast.error("Name, slug, reseller, and email are required");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.updateMerchant(editingMerchant.id, formData);
      setMerchants((prev) =>
        prev.map((m) => (m.id === editingMerchant.id ? res : m)),
      );
      toast.success("Merchant updated successfully");
      setIsEditOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to update merchant");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this merchant?")) return;

    try {
      await apiService.deleteMerchant(id);
      setMerchants((prev) => prev.filter((m) => m.id !== id));
      toast.success("Merchant deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete merchant");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      reseller_id: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      email: "",
      description: "",
      price_bump_percentage: 0,
      price_bump_fixed: 0,
      is_active: true,
      is_open: true,
    });
  };

  const filteredMerchants = merchants.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.city.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const MerchantForm = () => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input
            name="name"
            placeholder="Restaurant name"
            value={formData.name}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <Label>Slug *</Label>
          <Input
            name="slug"
            placeholder="restaurant-name"
            value={formData.slug}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div>
        <Label>Reseller *</Label>
        <Select
          value={formData.reseller_id}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, reseller_id: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reseller" />
          </SelectTrigger>
          <SelectContent>
            {resellers.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Email *</Label>
        <Input
          name="email"
          type="email"
          placeholder="contact@restaurant.com"
          value={formData.email}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <Label>Phone</Label>
        <Input
          name="phone"
          placeholder="+1 (555) 000-0000"
          value={formData.phone}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <Label>Address Line 1 *</Label>
        <Input
          name="address_line1"
          placeholder="123 Main Street"
          value={formData.address_line1}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <Label>Address Line 2</Label>
        <Input
          name="address_line2"
          placeholder="Suite 100"
          value={formData.address_line2}
          onChange={handleInputChange}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>City *</Label>
          <Input
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <Label>State *</Label>
          <Input
            name="state"
            placeholder="State"
            value={formData.state}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <Label>ZIP *</Label>
          <Input
            name="zip_code"
            placeholder="12345"
            value={formData.zip_code}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          name="description"
          placeholder="Restaurant description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Price Bump %</Label>
          <Input
            name="price_bump_percentage"
            type="number"
            step="0.01"
            value={formData.price_bump_percentage}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <Label>Price Bump Fixed ($)</Label>
          <Input
            name="price_bump_fixed"
            type="number"
            step="0.01"
            value={formData.price_bump_fixed}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="space-y-2">
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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_open"
            checked={formData.is_open}
            onChange={handleInputChange}
            className="rounded"
          />
          <Label>Open</Label>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Merchants Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage merchant locations and settings
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#cc0000] hover:bg-[#a90000]">
                <Plus className="w-4 h-4 mr-2" />
                New Merchant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Merchant</DialogTitle>
              </DialogHeader>
              <MerchantForm />
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="w-full bg-[#cc0000] hover:bg-[#a90000]"
              >
                {saving ? "Creating..." : "Create Merchant"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Merchants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Merchants</CardTitle>
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
            ) : filteredMerchants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No merchants found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Reseller</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchants.map((merchant) => (
                      <TableRow key={merchant.id}>
                        <TableCell className="font-medium">
                          {merchant.name}
                        </TableCell>
                        <TableCell>
                          {resellers.find((r) => r.id === merchant.reseller_id)
                            ?.name || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3" />
                            {merchant.city}, {merchant.state}
                          </div>
                        </TableCell>
                        <TableCell>{merchant.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge
                              className={
                                merchant.is_active
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-100 border-0"
                              }
                            >
                              {merchant.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge
                              className={
                                merchant.is_open
                                  ? "bg-sky-100 text-sky-700 hover:bg-sky-100 border-0"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-100 border-0"
                              }
                            >
                              {merchant.is_open ? "Open" : "Closed"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(merchant)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(merchant.id)}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Merchant</DialogTitle>
            </DialogHeader>
            <MerchantForm />
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full bg-[#cc0000] hover:bg-[#a90000]"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminMerchantsPage;
