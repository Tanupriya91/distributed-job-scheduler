"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCreateOrganization } from "@/lib/hooks/organizations";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { Select, Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, token, user, currentOrgId, setCurrentOrgId, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const createOrg = useCreateOrganization();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [isLoading, token, router]);

  if (isLoading || !token || !user) {
    return <FullPageSpinner />;
  }

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    const org = await createOrg.mutateAsync({ name: newOrgName });
    await refreshUser();
    setCurrentOrgId(org.id);
    setNewOrgName("");
    setShowNewOrg(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard/projects" className="text-base font-semibold text-slate-900">
              Job Scheduler
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/dashboard/projects" className="text-slate-600 hover:text-slate-900">
                Projects
              </Link>
              <Link href="/dashboard/workers" className="text-slate-600 hover:text-slate-900">
                Workers
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user.organizations.length > 0 && (
              <Select value={currentOrgId ?? ""} onChange={(e) => setCurrentOrgId(e.target.value)} className="w-44">
                {user.organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="secondary" onClick={() => setShowNewOrg(true)}>
              + Org
            </Button>
            <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <Modal open={showNewOrg} onClose={() => setShowNewOrg(false)} title="Create organization">
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <Label>Organization name</Label>
            <Input required value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={createOrg.isPending}>
            {createOrg.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
