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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Search, Users } from "lucide-react";

const USER_ROLES = ["CONSUMER", "MERCHANT", "SUPER_ADMIN"];

const AdminUsersPage = () => {
  useAuth();
  const [users, setUsers] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "CONSUMER",
    phone: "",
    merchant_id: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, merchantsRes] = await Promise.all([
        apiService.getUsers?.() || apiService.fetchData("GET", "/api/users"),
        apiService.getMerchants(),
      ]).catch(() => [[], []]);

      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setMerchants(Array.isArray(merchantsRes) ? merchantsRes : []);
    } catch (error) {
      console.error("Error loading data:", error);
      setUsers([]);
      setMerchants([]);
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

  const handleRoleChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
      merchant_id: value !== "MERCHANT" ? "" : prev.merchant_id,
    }));
  };

  const handleCreate = async () => {
    if (!formData.email || !formData.name) {
      toast.error("Email and name are required");
      return;
    }

    if (formData.role === "MERCHANT" && !formData.merchant_id) {
      toast.error("Merchant users must be assigned to a merchant");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.fetchData("POST", "/api/users", formData);
      setUsers((prev) => [...prev, res]);
      toast.success("User created successfully");
      resetForm();
      setIsCreateOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || "",
      merchant_id: user.merchant_id || "",
      is_active: user.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!formData.email || !formData.name) {
      toast.error("Email and name are required");
      return;
    }

    if (formData.role === "MERCHANT" && !formData.merchant_id) {
      toast.error("Merchant users must be assigned to a merchant");
      return;
    }

    try {
      setSaving(true);
      const res = await apiService.fetchData(
        "PUT",
        `/api/users/${editingUser.id}`,
        formData,
      );
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res : u)));
      toast.success("User updated successfully");
      setIsEditOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await apiService.fetchData("DELETE", `/api/users/${id}`, null);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await apiService.fetchData("PUT", `/api/users/${user.id}`, {
        ...user,
        is_active: !user.is_active,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res : u)));
      toast.success(`User ${res.is_active ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update user status");
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      name: "",
      role: "CONSUMER",
      phone: "",
      merchant_id: "",
      is_active: true,
    });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const UserForm = () => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email *</Label>
          <Input
            name="email"
            type="email"
            placeholder="user@example.com"
            value={formData.email}
            onChange={handleInputChange}
            disabled={!!editingUser}
          />
        </div>
        <div>
          <Label>Name *</Label>
          <Input
            name="name"
            placeholder="Full name"
            value={formData.name}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div>
        <Label>Role *</Label>
        <Select value={formData.role} onValueChange={handleRoleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {formData.role === "MERCHANT" && (
        <div>
          <Label>Assign to Merchant *</Label>
          <Select
            value={formData.merchant_id}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, merchant_id: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select merchant" />
            </SelectTrigger>
            <SelectContent>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
    </div>
  );

  const getRoleColor = (role) => {
    const colors = {
      SUPER_ADMIN: "destructive",
      ADMIN: "destructive",
      MERCHANT: "default",
      CONSUMER: "outline",
    };
    return colors[role] || "outline";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Users Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage user accounts and role assignments
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <UserForm />
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {saving ? "Creating..." : "Create User"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
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
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const assignmentName =
                        user.role === "MERCHANT"
                          ? merchants.find((m) => m.id === user.merchant_id)
                              ?.name
                          : null;

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleColor(user.role)}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignmentName ? (
                              <span className="text-sm text-gray-600">
                                {assignmentName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {user.phone}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.is_active ? "default" : "secondary"}
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={user.is_active ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              title={user.is_active ? "Deactivate" : "Activate"}
                            >
                              {user.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <UserForm />
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
