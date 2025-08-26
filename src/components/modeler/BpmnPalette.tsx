import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Circle, 
  Square, 
  Diamond, 
  Hexagon, 
  ArrowRight, 
  GitBranch,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PaletteItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: string;
}

const paletteItems: PaletteItem[] = [
  // Events
  { id: "start-event", name: "Start Event", icon: <Circle className="w-6 h-6 text-green-600" />, description: "Início do processo", category: "events" },
  { id: "end-event", name: "End Event", icon: <Circle className="w-6 h-6 text-red-600 fill-current" />, description: "Fim do processo", category: "events" },
  { id: "intermediate-event", name: "Intermediate Event", icon: <Circle className="w-6 h-6 text-yellow-600" />, description: "Evento intermediário", category: "events" },
  
  // Tasks
  { id: "task", name: "Task", icon: <Square className="w-6 h-6 text-blue-600" />, description: "Tarefa genérica", category: "tasks" },
  { id: "user-task", name: "User Task", icon: <Square className="w-6 h-6 text-blue-600" />, description: "Tarefa do usuário", category: "tasks" },
  { id: "service-task", name: "Service Task", icon: <Square className="w-6 h-6 text-purple-600" />, description: "Tarefa de serviço", category: "tasks" },
  { id: "script-task", name: "Script Task", icon: <Square className="w-6 h-6 text-orange-600" />, description: "Tarefa de script", category: "tasks" },
  
  // Gateways
  { id: "exclusive-gateway", name: "Exclusive Gateway", icon: <Diamond className="w-6 h-6 text-yellow-600" />, description: "Gateway exclusivo", category: "gateways" },
  { id: "parallel-gateway", name: "Parallel Gateway", icon: <Diamond className="w-6 h-6 text-green-600" />, description: "Gateway paralelo", category: "gateways" },
  { id: "inclusive-gateway", name: "Inclusive Gateway", icon: <Diamond className="w-6 h-6 text-blue-600" />, description: "Gateway inclusivo", category: "gateways" },
  
  // Flow Objects
  { id: "sequence-flow", name: "Sequence Flow", icon: <ArrowRight className="w-6 h-6 text-gray-600" />, description: "Fluxo sequencial", category: "flows" },
  { id: "message-flow", name: "Message Flow", icon: <GitBranch className="w-6 h-6 text-gray-600" />, description: "Fluxo de mensagem", category: "flows" },
  
  // Swimlanes
  { id: "lane", name: "Lane", icon: <Hexagon className="w-6 h-6 text-indigo-600" />, description: "Raia", category: "swimlanes" },
  { id: "pool", name: "Pool", icon: <Hexagon className="w-6 h-6 text-indigo-800" />, description: "Pool", category: "swimlanes" },
];

const categoryLabels = {
  events: "Eventos",
  tasks: "Tarefas", 
  gateways: "Gateways",
  flows: "Fluxos",
  swimlanes: "Raias"
};

export function BpmnPalette() {
  const [openCategories, setOpenCategories] = useState<string[]>(["events", "tasks"]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const categories = Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>;

  const handleDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-80 border-r border-border bg-background overflow-y-auto">
      <Card className="rounded-none border-0 border-b">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            Paleta BPMN
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="p-4 space-y-2">
        {categories.map(category => {
          const items = paletteItems.filter(item => item.category === category);
          const isOpen = openCategories.includes(category);
          
          return (
            <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors">
                <span>{categoryLabels[category]}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-1 mt-1">
                {items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="flex items-center gap-3 p-3 bg-card hover:bg-accent border border-border rounded-md cursor-grab active:cursor-grabbing transition-colors group"
                  >
                    <div className="flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground group-hover:text-accent-foreground">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}