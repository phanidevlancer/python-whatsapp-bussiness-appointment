'use client';

import { useState } from 'react';
import { Plus, PowerOff, Clock, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useServicesList, useCreateService, useDeleteService, useUpdateService } from '@/hooks/useServices';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ServicesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newDesc, setNewDesc] = useState('');

  const { data: services, isLoading } = useServicesList(true);
  const { mutate: create, isPending: creating } = useCreateService();
  const { mutate: deactivate } = useDeleteService();
  const { mutate: update } = useUpdateService();

  const handleCreate = () => {
    if (!newName || !newDuration) return;
    create(
      { name: newName, description: newDesc || undefined, duration_minutes: parseInt(newDuration) },
      {
        onSuccess: () => {
          toast.success('Service created successfully');
          setShowCreate(false);
          setNewName(''); setNewDuration('30'); setNewDesc('');
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create service'),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Services</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your clinic services and pricing</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowCreate(true)}
        >
          New Service
        </Button>
      </div>

      {/* Create Service Form */}
      {showCreate && (
        <Card className="p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>Create New Service</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Service Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              leftIcon={<Tag size={16} />}
            />
            <Input
              placeholder="Duration (minutes)"
              type="number"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              leftIcon={<Clock size={16} />}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              resize="none"
              rows={1}
            />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              isLoading={creating}
            >
              {creating ? 'Creating...' : 'Create Service'}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Services Table */}
      <Card className="p-0 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton variant="text" className="w-20 h-4" />
              </div>
            ))}
          </div>
        ) : !services?.length ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag size={32} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No services found</h3>
            <p className="text-sm text-gray-500">Create your first service to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead className="w-12"><span className="sr-only">Icon</span></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
                      <Tag size={18} className="text-primary-600" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900">{s.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">{s.description ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{s.duration_minutes} min</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.is_active ? 'success' : 'default'}
                      size="sm"
                      dot
                    >
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    {s.is_active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<PowerOff size={16} />}
                        onClick={() => {
                          if (confirm('Deactivate this service?')) {
                            deactivate(s.id, {
                              onSuccess: () => toast.success('Service deactivated'),
                            });
                          }
                        }}
                        className="text-gray-400 hover:text-error-600"
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          update({ id: s.id, is_active: true }, {
                            onSuccess: () => toast.success('Service activated'),
                          })
                        }
                        className="text-gray-400 hover:text-success-600"
                      >
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
