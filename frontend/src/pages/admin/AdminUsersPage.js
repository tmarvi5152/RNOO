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
  DialogDescription,
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
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Users,
  Mail,
  Phone,
  KeyRound,
} from "lucide-react";

const USER_ROLES = ["consumer", "merchant", "reseller", "super_admin"];
const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character";

const splitName = (fullName = "") => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const getUserFirstName = (user = {}) => {
  if (user.first_name) return user.first_name;
  return splitName(user.name).firstName;
};

const getUserLastName = (user = {}) => {
  if (user.last_name) return user.last_name;
  return splitName(user.name).lastName;
};

const getUserDisplayName = (user = {}) => {
  const firstName = getUserFirstName(user);
  const lastName = getUserLastName(user);
  const full = `${firstName} ${lastName}`.trim();
  return full || user.name || "N/A";
};

const getUserMerchantIds = (user = {}) => {
  const ids = Array.isArray(user.merchant_ids)
    ? user.merchant_ids.map((id) => String(id))
    : [];
  const singleId = user.merchant_id ? String(user.merchant_id) : "";
  if (singleId && !ids.includes(singleId)) {
    ids.push(singleId);
  }
  return ids;
};

const getMerchantDisplayId = (merchant = {}) => {
  // Prefer business-facing IDs over internal UUIDs.
  const preferred =
    merchant?.shepherd_config?.merchant_id ||
    merchant?.license_id ||
    merchant?.site_code ||
    merchant?.external_id;
  return String(preferred || merchant?.id || "");
};

const roleLabel = (role) =>
  String(role || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const AdminUsersPage = () => {
  useAuth();
  const [users, setUsers] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [merchantAccessSearchTerm, setMerchantAccessSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: "consumer",
    phone: "",
    merchant_id: "",
    merchant_ids: [],
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, merchantsRes] = await Promise.all([
        apiService.getUsers(),
        apiService.getMerchants(),
      ]);

      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
      setMerchants(Array.isArray(merchantsRes?.data) ? merchantsRes.data : []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load users");
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
    const allMerchantIds = merchants.map((m) => String(m.id));
    setFormData((prev) => ({
      ...prev,
      role: value,
      merchant_id:
        value === "super_admin"
          ? (allMerchantIds[0] || "")
          : (prev.merchant_ids?.[0] || prev.merchant_id || ""),
      merchant_ids:
        value === "super_admin"
          ? allMerchantIds
          : (prev.merchant_ids || []),
    }));
  };

  const toggleMerchantAssignment = (merchantId) => {
    setFormData((prev) => {
      const id = String(merchantId);
      const existing = Array.isArray(prev.merchant_ids) ? prev.merchant_ids : [];
      const selected = existing.includes(id)
        ? existing.filter((m) => m !== id)
        : [...existing, id];

      return {
        ...prev,
        merchant_ids: selected,
        merchant_id: selected[0] || "",
      };
    });
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    resetForm();
    setMerchantAccessSearchTerm("");
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (
      !formData.email ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.phone ||
      !formData.password
    ) {
      toast.error("First name, last name, email, phone, and password are required");
      return;
    }

    if (!isValidPassword(formData.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (formData.role === "merchant" && (!formData.merchant_ids || formData.merchant_ids.length === 0)) {
      toast.error("Merchant users must be assigned to at least one merchant");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim(),
        password: formData.password,
        role: formData.role,
        phone: formData.phone.trim(),
        merchant_ids:
          formData.role === "super_admin"
            ? merchants.map((m) => String(m.id))
            : formData.role === "merchant"
            ? formData.merchant_ids
            : [],
        merchant_id:
          formData.role === "super_admin"
            ? (merchants[0]?.id ? String(merchants[0].id) : null)
            : formData.role === "merchant"
            ? (formData.merchant_ids[0] || null)
            : null,
      };

      const res = await apiService.createUser(payload);
      setUsers((prev) => [...prev, res.data]);
      toast.success("User created successfully");
      resetForm();
      setIsCreateOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    const fallback = splitName(user.name);
    setEditingUser(user);
    setMerchantAccessSearchTerm("");
    setFormData({
      email: user.email,
      first_name: user.first_name || fallback.firstName,
      last_name: user.last_name || fallback.lastName,
      password: "",
      role: user.role,
      phone: user.phone || "",
      merchant_id: getUserMerchantIds(user)[0] || "",
      merchant_ids: getUserMerchantIds(user),
      is_active: Boolean(user.is_active),
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (
      !formData.email ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.phone
    ) {
      toast.error("First name, last name, email, and phone are required");
      return;
    }

    if (formData.role === "merchant" && (!formData.merchant_ids || formData.merchant_ids.length === 0)) {
      toast.error("Merchant users must be assigned to at least one merchant");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim(),
        role: formData.role,
        phone: formData.phone.trim(),
        merchant_ids:
          formData.role === "super_admin"
            ? merchants.map((m) => String(m.id))
            : formData.role === "merchant"
            ? formData.merchant_ids
            : [],
        merchant_id:
          formData.role === "super_admin"
            ? (merchants[0]?.id ? String(merchants[0].id) : null)
            : formData.role === "merchant"
            ? (formData.merchant_ids[0] || null)
            : null,
        is_active: Boolean(formData.is_active),
      };

      const res = await apiService.updateUser(editingUser.id, payload);
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? res.data : u)),
      );
      toast.success("User updated successfully");
      setIsEditOpen(false);
      setEditingUser(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await apiService.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleOpenResetPassword = (user) => {
    setResetPasswordUser(user);
    setResetPassword("");
    setResetPasswordConfirm("");
    setIsResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser?.id) {
      toast.error("Unable to reset password: missing user id");
      return;
    }

    if (!resetPassword) {
      toast.error("New password is required");
      return;
    }

    if (!isValidPassword(resetPassword)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSaving(true);
      try {
        await apiService.resetUserPassword(resetPasswordUser.id, {
          password: resetPassword,
        });
      } catch (error) {
        if ([404, 405].includes(error?.response?.status)) {
          await apiService.resetUserPasswordByBody({
            user_id: resetPasswordUser.id,
            password: resetPassword,
          });
        } else {
          throw error;
        }
      }
      toast.success(`Password reset for ${resetPasswordUser.email}`);
      setIsResetPasswordOpen(false);
      setResetPasswordUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if ([404, 405].includes(status) || detail === "Not Found") {
        toast.error("Password reset endpoint mismatch (404/405). Restart backend so latest routes are loaded, then try again.");
      } else {
        toast.error(detail || "Failed to reset password");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await apiService.updateUser(user.id, {
        email: user.email,
        first_name: getUserFirstName(user),
        last_name: getUserLastName(user),
        name: getUserDisplayName(user),
        role: user.role,
        phone: user.phone || "",
        merchant_ids: getUserMerchantIds(user),
        merchant_id: getUserMerchantIds(user)[0] || null,
        is_active: !user.is_active,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data : u)));
      toast.success(`User ${res.data?.is_active ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Failed to toggle user active:", error);
      toast.error("Failed to update user status");
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      role: "consumer",
      phone: "",
      merchant_id: "",
      merchant_ids: [],
      is_active: true,
    });
  };

  const filteredUsers = users.filter(
    (u) => {
      const merchantMatches = getUserMerchantIds(u)
        .map((merchantId) => {
          const merchant = merchants.find((m) => String(m.id) === String(merchantId));
          return `${merchant?.name || ""} ${merchantId}`.toLowerCase();
        })
        .join(" ");

      const term = searchTerm.toLowerCase();
      return (
        String(getUserDisplayName(u) || "").toLowerCase().includes(term) ||
        String(u.email || "").toLowerCase().includes(term) ||
        String(u.role || "").toLowerCase().includes(term) ||
        merchantMatches.includes(term)
      );
    },
  );

  const filteredMerchantOptions = merchants.filter((merchant) => {
    const term = String(merchantAccessSearchTerm || "").toLowerCase().trim();
    if (!term) return true;

    const merchantName = String(merchant?.name || "").toLowerCase();
    const displayMerchantId = getMerchantDisplayId(merchant).toLowerCase();
    const internalMerchantId = String(merchant?.id || "").toLowerCase();
    return (
      merchantName.includes(term) ||
      displayMerchantId.includes(term) ||
      internalMerchantId.includes(term)
    );
  });

  const isValidPassword = (value) => {
    const hasMinLength = String(value || "").length >= 8;
    const hasUppercase = /[A-Z]/.test(value || "");
    const hasNumber = /\d/.test(value || "");
    const hasSpecial = /[^A-Za-z0-9]/.test(value || "");
    return hasMinLength && hasUppercase && hasNumber && hasSpecial;
  };

  const renderUserForm = (mode = "create") => (
    <div className="space-y-5 max-h-[68vh] overflow-y-auto pr-1">
      <div className="space-y-4 rounded-lg border p-4 bg-slate-50/40">
        <h3 className="text-sm font-semibold text-slate-700">Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email *</Label>
            <Input
              name="email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label>Phone Number *</Label>
            <Input
              name="phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>First Name *</Label>
            <Input
              name="first_name"
              placeholder="First name"
              value={formData.first_name}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label>Last Name *</Label>
            <Input
              name="last_name"
              placeholder="Last name"
              value={formData.last_name}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4 bg-slate-50/40">
        <h3 className="text-sm font-semibold text-slate-700">Access</h3>
        <div>
          <Label>Role *</Label>
          <Select value={formData.role} onValueChange={handleRoleChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "create" && (
          <div>
            <Label>Password *</Label>
            <Input
              name="password"
              type="password"
              placeholder="Set a temporary password"
              value={formData.password}
              onChange={handleInputChange}
            />
            <p className="mt-1 text-xs text-gray-500">{PASSWORD_POLICY_MESSAGE}</p>
          </div>
        )}

        <div>
          <Label>
            Merchant Access{formData.role === "merchant" ? " *" : ""}
          </Label>

          {formData.role === "super_admin" ? (
            <p className="mt-1 text-xs text-gray-500">
              Super admin will automatically have access to all merchants.
            </p>
          ) : (
            <>
              <Input
                value={merchantAccessSearchTerm}
                onChange={(e) => setMerchantAccessSearchTerm(e.target.value)}
                placeholder="Search merchants by name or ID..."
                className="mt-2"
              />
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border bg-white p-2 space-y-2">
                {filteredMerchantOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">No merchants available</p>
                ) : (
                  filteredMerchantOptions.map((merchant) => {
                    const merchantId = String(merchant.id);
                    const displayMerchantId = getMerchantDisplayId(merchant);
                    const checked = formData.merchant_ids.includes(merchantId);
                    return (
                      <label
                        key={merchant.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMerchantAssignment(merchantId)}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">
                          {merchant.name} ({displayMerchantId})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formData.merchant_ids.length} merchant{formData.merchant_ids.length === 1 ? "" : "s"} selected
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-white">
          <Label className="mb-0">Active</Label>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, is_active: Boolean(checked) }))
            }
          />
        </div>
      </div>

      {mode === "edit" && (
        <div>
          <p className="text-xs text-gray-500">
            Need to change password? Use the key button in the user row.
          </p>
        </div>
      )}
    </div>
  );

  const getRoleColor = (role) => {
    const colors = {
      super_admin: "destructive",
      reseller: "secondary",
      merchant: "default",
      consumer: "outline",
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
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Set required identity and access details for the new user account.
                </DialogDescription>
              </DialogHeader>
              {renderUserForm("create")}
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
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
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
                      const assignmentEntries = getUserMerchantIds(user)
                        .map((merchantId) => {
                          const merchant = merchants.find((m) => String(m.id) === String(merchantId));
                          return {
                            id: merchantId,
                            name: merchant?.name || "Unknown Merchant",
                            displayId: getMerchantDisplayId(merchant || { id: merchantId }),
                          };
                        });

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {getUserFirstName(user) || "N/A"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getUserLastName(user) || "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleColor(user.role)}>
                              {roleLabel(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.role === "super_admin" ? (
                              <span className="text-sm text-gray-600">All merchants</span>
                            ) : assignmentEntries.length > 0 ? (
                              <div className="space-y-1">
                                {assignmentEntries.map((entry) => (
                                  <div key={entry.id} className="text-xs text-gray-600">
                                    {entry.name} ({entry.displayId})
                                  </div>
                                ))}
                              </div>
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
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResetPassword(user)}
                              title="Reset Password"
                            >
                              <KeyRound className="w-4 h-4" />
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
              <DialogDescription>
                Super admins can update all profile fields, including email and role.
              </DialogDescription>
            </DialogHeader>
            {renderUserForm("edit")}
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isResetPasswordOpen}
          onOpenChange={(open) => {
            setIsResetPasswordOpen(open);
            if (!open) {
              setResetPasswordUser(null);
              setResetPassword("");
              setResetPasswordConfirm("");
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reset User Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Reset password for <strong>{resetPasswordUser?.email}</strong>
              </p>
              <div>
                <Label>New Password *</Label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <Label>Confirm Password *</Label>
                <Input
                  type="password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <p className="text-xs text-gray-500">{PASSWORD_POLICY_MESSAGE}</p>
              <Button
                onClick={handleResetPassword}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {saving ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
