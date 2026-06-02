import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Search,
  Shield,
  LogOut,
  Scale,
  Moon,
  Sun,
  Calendar as CalendarIcon,
  ScrollText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";

const items = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Novo Cliente", url: "/clientes/novo", icon: UserPlus, requireWrite: true },
  { title: "Calendário", url: "/calendario", icon: CalendarIcon },
  { title: "Buscar", url: "/buscar", icon: Search },
];

export function AppSidebar({
  theme,
  toggleTheme,
}: {
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const { signOut, role, fullName, isMaster, canWrite } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Departamento Jurídico</span>
            <span className="text-xs text-sidebar-foreground/60">Sistema Interno</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((i) => !i.requireWrite || canWrite)
                .map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isMaster && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/usuarios")}>
                    <Link to="/usuarios">
                      <Shield className="h-4 w-4" />
                      <span>Usuários & Permissões</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/auditoria")}>
                    <Link to="/auditoria">
                      <ScrollText className="h-4 w-4" />
                      <span>Relatório de Atividades</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="text-xs">
            <div className="font-medium truncate">{fullName ?? "Usuário"}</div>
            <div className="text-sidebar-foreground/60">
              {role ? ROLE_LABELS[role] : "Sem função"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}