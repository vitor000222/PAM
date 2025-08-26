import { useState } from "react";
import { 
  LayoutDashboard, 
  FolderPlus, 
  GitBranch, 
  FileText, 
  Settings, 
  Users,
  Activity,
  ChevronDown,
  Workflow
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "New Project", url: "/projects/new", icon: FolderPlus },
  { title: "Modeler", url: "/modeler", icon: Workflow },
];

const projectItems = [
  { title: "Workflows", url: "/workflows", icon: GitBranch },
  { title: "Documentation", url: "/docs", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: Activity },
];

const systemItems = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Team", url: "/team", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground";

  return (
    <Sidebar 
      className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300 bg-sidebar border-r border-sidebar-border`}
    >
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sidebar-foreground">Ploomes</h2>
              <p className="text-xs text-sidebar-foreground/70">Architecture Mapper</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className={`text-sidebar-foreground/70 font-medium ${collapsed ? "sr-only" : ""}`}>
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Project Tools */}
        {!collapsed && (
          <SidebarGroup>
            <Collapsible open={isProjectsOpen} onOpenChange={setIsProjectsOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sidebar-foreground/70 font-medium hover:text-sidebar-foreground transition-colors">
                  Project Tools
                  <ChevronDown className={`w-4 h-4 transition-transform ${isProjectsOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {projectItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} className={getNavClass}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* System */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className={`text-sidebar-foreground/70 font-medium ${collapsed ? "sr-only" : ""}`}>
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}