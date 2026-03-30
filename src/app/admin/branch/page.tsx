'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Upload } from 'lucide-react';
import { useRequirePermission } from '@/hooks/use-require-permission';

type TabKey = 'merchants' | 'merchant-users' | 'product-categories';

export default function BranchPage() {
  useRequirePermission('branch');
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('merchants');
  const [merchants, setMerchants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [merchantUsers, setMerchantUsers] = useState<any[]>([]);
  const [allMerchants, setAllMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Merchant form
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<any>(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantAccountNumber, setMerchantAccountNumber] = useState('');
  const [merchantIconFile, setMerchantIconFile] = useState<File | null>(null);
  const [merchantIconPreview, setMerchantIconPreview] = useState('');
  const [merchantContactPersonName, setMerchantContactPersonName] = useState('');
  const [merchantContactPersonPhone, setMerchantContactPersonPhone] = useState('');
  const [merchantContactPersonEmail, setMerchantContactPersonEmail] = useState('');
  const [merchantAdditionalContact, setMerchantAdditionalContact] = useState('');
  const [merchantBnplEnabled, setMerchantBnplEnabled] = useState(true);
  const [merchantStatus, setMerchantStatus] = useState('ACTIVE');

  // Category form
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryName, setCategoryName] = useState('');

  // Merchant user form
  const [muFullName, setMuFullName] = useState('');
  const [muEmail, setMuEmail] = useState('');
  const [muPhone, setMuPhone] = useState('');
  const [muPassword, setMuPassword] = useState('');
  const [muRole, setMuRole] = useState('Merchant');
  const [muMerchantId, setMuMerchantId] = useState('');

  const fetchMerchants = useCallback(async () => {
    try {
      const res = await fetch('/api/merchants');
      if (res.ok) setMerchants(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/merchants/categories');
      if (res.ok) setCategories(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchMerchantUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const users = await res.json();
        setMerchantUsers(users.filter((u: any) => u.role === 'Merchant'));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMerchants();
    fetchCategories();
    fetchMerchantUsers();
  }, [fetchMerchants, fetchCategories, fetchMerchantUsers]);

  useEffect(() => {
    setAllMerchants(merchants.filter(m => m.status === 'ACTIVE'));
  }, [merchants]);

  // --- Merchants Tab ---
  const resetMerchantForm = () => {
    setEditingMerchant(null);
    setMerchantName('');
    setMerchantAccountNumber('');
    setMerchantIconFile(null);
    setMerchantIconPreview('');
    setMerchantContactPersonName('');
    setMerchantContactPersonPhone('');
    setMerchantContactPersonEmail('');
    setMerchantAdditionalContact('');
    setMerchantBnplEnabled(true);
    setMerchantStatus('ACTIVE');
  };

  const handleSaveMerchant = async () => {
    setLoading(true);
    try {
      let iconUrl: string | null = null;
      if (merchantIconFile) {
        const reader = new FileReader();
        iconUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(merchantIconFile);
        });
      } else if (editingMerchant?.iconUrl) {
        iconUrl = editingMerchant.iconUrl;
      }

      const method = editingMerchant ? 'PUT' : 'POST';
      const body = editingMerchant
        ? {
            id: editingMerchant.id,
            name: merchantName,
            status: merchantStatus,
            accountNumber: merchantAccountNumber,
            iconUrl,
            contactPersonName: merchantContactPersonName,
            contactPersonPhone: merchantContactPersonPhone,
            contactPersonEmail: merchantContactPersonEmail,
            additionalContactInfo: merchantAdditionalContact,
            bnplEnabled: merchantBnplEnabled,
          }
        : {
            name: merchantName,
            status: merchantStatus,
            accountNumber: merchantAccountNumber,
            iconUrl,
            contactPersonName: merchantContactPersonName,
            contactPersonPhone: merchantContactPersonPhone,
            contactPersonEmail: merchantContactPersonEmail,
            additionalContactInfo: merchantAdditionalContact,
            bnplEnabled: merchantBnplEnabled,
          };
      const res = await fetch('/api/merchants', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast({ title: editingMerchant ? 'Update submitted for approval' : 'Merchant submitted for approval' });
      setMerchantDialogOpen(false);
      resetMerchantForm();
      fetchMerchants();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDeleteMerchant = async (id: string) => {
    try {
      const res = await fetch(`/api/merchants?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Delete submitted for approval' });
      fetchMerchants();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // --- Categories Tab ---
  const handleSaveCategory = async () => {
    setLoading(true);
    try {
      const method = editingCategory ? 'PUT' : 'POST';
      const body = editingCategory
        ? { id: editingCategory.id, name: categoryName }
        : { name: categoryName };
      const res = await fetch('/api/merchants/categories', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast({ title: editingCategory ? 'Category updated' : 'Category created' });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/merchants/categories?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Category deleted' });
      fetchCategories();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // --- Merchant Users Tab ---
  const handleCreateMerchantUser = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: muFullName,
          email: muEmail,
          phoneNumber: muPhone,
          password: muPassword || undefined,
          role: muRole,
          providerId: null,
          status: 'Active',
          merchantId: muMerchantId || undefined,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create user'); }
      toast({ title: 'Merchant user submitted for approval' });
      setMuFullName(''); setMuEmail(''); setMuPhone(''); setMuPassword(''); setMuMerchantId('');
      fetchMerchantUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'merchants', label: 'Merchants' },
    { key: 'merchant-users', label: 'Merchant Users' },
    { key: 'product-categories', label: 'Product Categories' },
  ];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Branch</h2>
        <p className="text-muted-foreground">Create and manage merchants and product categories.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Merchants Tab */}
      {activeTab === 'merchants' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end mb-4">
              <Dialog open={merchantDialogOpen} onOpenChange={(o) => { setMerchantDialogOpen(o); if (!o) resetMerchantForm(); }}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600"><PlusCircle className="mr-2 h-4 w-4" />Add Merchant</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingMerchant ? 'Edit Merchant' : 'Add Merchant'}</DialogTitle></DialogHeader>
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
                      <div>
                        <Label>Name <span className="text-red-500">*</span></Label>
                        <Input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="Merchant name" />
                      </div>
                      <div>
                        <Label>Account Number</Label>
                        <Input value={merchantAccountNumber} onChange={e => setMerchantAccountNumber(e.target.value)} placeholder="Account number" />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={merchantStatus} onValueChange={setMerchantStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Icon</Label>
                        <div className="flex items-center gap-4">
                          {(merchantIconPreview || editingMerchant?.iconUrl) && (
                            <img
                              src={merchantIconPreview || editingMerchant?.iconUrl}
                              alt="Merchant icon preview"
                              className="h-16 w-16 rounded-lg object-cover border"
                            />
                          )}
                          <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors text-sm">
                            <Upload className="h-4 w-4" />
                            {merchantIconFile ? merchantIconFile.name : 'Upload icon'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setMerchantIconFile(file);
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => setMerchantIconPreview(reader.result as string);
                                  reader.readAsDataURL(file);
                                } else {
                                  setMerchantIconPreview('');
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* BNPL Toggle */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment Options</h3>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable BNPL (Buy Now, Pay Later)</Label>
                          <p className="text-sm text-muted-foreground">Allow this merchant to support BNPL transactions</p>
                        </div>
                        <Switch checked={merchantBnplEnabled} onCheckedChange={setMerchantBnplEnabled} />
                      </div>
                    </div>

                    {/* Business Deal / Contact Person */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Business Deal Information</h3>
                      <div>
                        <Label>Contact Person Name</Label>
                        <Input value={merchantContactPersonName} onChange={e => setMerchantContactPersonName(e.target.value)} placeholder="Full name of contact person" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Contact Person Phone</Label>
                          <Input value={merchantContactPersonPhone} onChange={e => setMerchantContactPersonPhone(e.target.value)} placeholder="Phone number" />
                        </div>
                        <div>
                          <Label>Contact Person Email</Label>
                          <Input type="email" value={merchantContactPersonEmail} onChange={e => setMerchantContactPersonEmail(e.target.value)} placeholder="Email address" />
                        </div>
                      </div>
                    </div>

                    {/* Additional Contact Info */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Contact Information</h3>
                      <div>
                        <Label>Extra Contact Details</Label>
                        <Textarea
                          value={merchantAdditionalContact}
                          onChange={e => setMerchantAdditionalContact(e.target.value)}
                          placeholder="Any additional contact information (e.g. secondary phone, address, social media, etc.)"
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setMerchantDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveMerchant} disabled={loading || !merchantName.trim()}>
                        {loading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {m.iconUrl && <img src={m.iconUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                        {m.name}
                      </div>
                    </TableCell>
                    <TableCell>{m.accountNumber || '-'}</TableCell>
                    <TableCell>{m.contactPersonName || '-'}</TableCell>
                    <TableCell><Badge variant={m.status === 'ACTIVE' ? 'default' : 'secondary'}>{m.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingMerchant(m); setMerchantName(m.name); setMerchantAccountNumber(m.accountNumber || ''); setMerchantIconPreview(m.iconUrl || ''); setMerchantContactPersonName(m.contactPersonName || ''); setMerchantContactPersonPhone(m.contactPersonPhone || ''); setMerchantContactPersonEmail(m.contactPersonEmail || ''); setMerchantAdditionalContact(m.additionalContactInfo || ''); setMerchantBnplEnabled(m.bnplEnabled !== false); setMerchantStatus(m.status || 'ACTIVE'); setMerchantDialogOpen(true); }}>Edit</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete {m.name}?</AlertDialogTitle><AlertDialogDescription>This action will submit a delete request for approval.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteMerchant(m.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {merchants.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No merchants found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Merchant Users Tab */}
      {activeTab === 'merchant-users' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Register Merchant User</CardTitle>
              <CardDescription>Create platform users with the merchant role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Full name</Label><Input value={muFullName} onChange={e => setMuFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={muEmail} onChange={e => setMuEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={muPhone} onChange={e => setMuPhone(e.target.value)} /></div>
              <div><Label>Password (optional)</Label><Input type="password" value={muPassword} onChange={e => setMuPassword(e.target.value)} /></div>
              <div>
                <Label>Role</Label>
                <Select value={muRole} onValueChange={setMuRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Merchant">Merchant</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Associate Merchant</Label>
                <Select value={muMerchantId} onValueChange={setMuMerchantId}>
                  <SelectTrigger><SelectValue placeholder="Select merchant" /></SelectTrigger>
                  <SelectContent>
                    {allMerchants.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">Users created here will be submitted for approval and won&apos;t appear until approved.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setMuFullName(''); setMuEmail(''); setMuPhone(''); setMuPassword(''); setMuMerchantId(''); }}>Cancel</Button>
                <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleCreateMerchantUser} disabled={loading || !muFullName || !muEmail || !muPhone}>
                  Submit for Approval
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Existing Merchant Users</CardTitle>
              <CardDescription>Accounts with the merchant role.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchantUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.fullName}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.phoneNumber}</TableCell>
                      <TableCell>{u.providerName || '-'}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                  {merchantUsers.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No merchant users found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Categories Tab */}
      {activeTab === 'product-categories' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end mb-4">
              <Dialog open={categoryDialogOpen} onOpenChange={(o) => { setCategoryDialogOpen(o); if (!o) { setEditingCategory(null); setCategoryName(''); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600"><PlusCircle className="mr-2 h-4 w-4" />Add Category</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Category name" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveCategory} disabled={loading || !categoryName.trim()}>
                        {loading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingCategory(c); setCategoryName(c.name); setCategoryDialogOpen(true); }}>Edit</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete {c.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the category.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCategory(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No categories found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
