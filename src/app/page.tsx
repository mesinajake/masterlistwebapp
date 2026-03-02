"use client";

import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { Header } from "@/frontend/components/layout/Header";
import { MasterListTable } from "@/frontend/components/dashboard/MasterListTable";
import { useMasterList } from "@/frontend/hooks/useMasterList";
import { useColumns } from "@/frontend/hooks/useColumns";
import { useExport } from "@/frontend/hooks/useExport";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { data, isLoading } = useMasterList();
  const { data: columnsData } = useColumns();
  const { exportCSV, isExporting } = useExport();

  return (
    <div className="flex h-screen w-full flex-col">
      <Header />

      <main className="flex flex-1 flex-col overflow-hidden bg-surface-light dark:bg-[#0b101a] p-6">
        <MasterListTable
          data={data}
          columns={columnsData?.columns ?? []}
          isLoading={isLoading}
          onExport={exportCSV}
          isExporting={isExporting}
        />
      </main>
    </div>
  );
}
