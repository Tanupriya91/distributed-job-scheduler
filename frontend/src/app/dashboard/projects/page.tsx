"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCreateProject, useProjects } from "@/lib/hooks/projects";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

export default function ProjectsPage() {
  const { currentOrgId } = useAuth();
  const { data, isLoading, error } = useProjects(currentOrgId, 1);
  const createProject = useCreateProject(currentOrgId);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createProject.mutateAsync({ name });
    setName("");
    setShowCreate(false);
  }

  if (!currentOrgId) {
    return (
      <EmptyState
        title="No organization selected"
        description="Create or select an organization from the header above."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>+ New project</Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load projects" />}

      {data && data.data.length === 0 && (
        <EmptyState title="No projects yet" description="Create your first project to get started." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardBody>
                <p className="font-medium text-slate-900">{project.name}</p>
                <p className="text-xs text-slate-400">/{project.slug}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New project">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Project name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={createProject.isPending}>
            {createProject.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
