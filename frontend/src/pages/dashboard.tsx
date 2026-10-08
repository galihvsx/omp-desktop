import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigate } from "@/hooks/use-navigate";
import { SquareTerminalIcon, SparklesIcon, SettingsIcon } from "lucide-react";
import DashboardLayout from "@/components/dashboard/layout";

export default function DashboardPage() {
  const { navigate } = useNavigate();

  return (
    <DashboardLayout props={{}}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-ui-lg font-semibold">OMP Desktop</h1>
          <p className="text-ui-sm text-muted-foreground">
            Shell desktop untuk CLI omp. Satu sesi per window, protokol JSON
            lines di atas stdin/stdout (<span className="font-mono">--mode rpc</span>).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-ui-base">Mulai bekerja</CardTitle>
            <CardDescription className="text-ui-sm">
              Buka workspace, jalankan sesi omp, lalu kirim pesan pertamamu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ name: "chat" })}>
              <SparklesIcon className="size-4" />
              Buka workspace
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ui-base">
                <SparklesIcon className="size-4" />
                Sesi
              </CardTitle>
              <CardDescription className="text-ui-sm">
                Status koneksi, mulai/hentikan sesi, dan persetujuan tool tampil
                langsung di workspace.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ui-base">
                <SquareTerminalIcon className="size-4" />
                Frame log
              </CardTitle>
              <CardDescription className="text-ui-sm">
                Setiap frame protokol yang masuk terlihat mentah — berguna saat
                menelusuri perilaku agen.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ui-base">
                <SettingsIcon className="size-4" />
                Pengaturan
              </CardTitle>
              <CardDescription className="text-ui-sm">
                Tema, ukuran teks UI, dan kontrol sesi ada di halaman
                pengaturan.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
