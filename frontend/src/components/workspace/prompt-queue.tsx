import { GripVertical, ListOrdered, PenLine, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { usePromptInputController } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
 Tooltip,
 TooltipContent,
 TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
 useOmpSession,
 useOmpSessionActions,
 type InterruptMode,
 type QueuedMessageQueue,
} from "@/features/omp";

const INTERRUPT_MODES: InterruptMode[] = ["immediate", "wait"];

interface QueueSection {
 queue: QueuedMessageQueue;
 label: string;
 hint: string;
 items: string[];
}

export function PromptQueue() {
 const { t } = useTranslation();
 const runtime = useOmpSession();
 const { steerQueued, removeQueued, reorderQueued, setInterruptMode } =
  useOmpSessionActions();
 const { textInput } = usePromptInputController();
 const [dragging, setDragging] = useState<{
  queue: QueuedMessageQueue;
  index: number;
 } | null>(null);
 const [dropIndex, setDropIndex] = useState<number | null>(null);

 const endDrag = useCallback(() => {
  setDragging(null);
  setDropIndex(null);
 }, []);

 const steering = runtime?.queued.steering ?? [];
 const followUp = runtime?.queued.followUp ?? [];
 const total = steering.length + followUp.length;

 if (!runtime || total === 0) {
  return null;
 }

 const sections: QueueSection[] = [
  {
   queue: "steering",
   label: t("workspace.queueSteering"),
   hint: t("workspace.queueSteeringHint"),
   items: steering,
  },
  {
   queue: "followUp",
   label: t("workspace.queueFollowUp"),
   hint: t("workspace.queueFollowUpHint"),
   items: followUp,
  },
 ];

 const editQueued = (text: string, queue: QueuedMessageQueue) => {
  void (async () => {
   if (await removeQueued(text, queue)) {
    textInput.setInput(text);
   }
  })();
 };

 const modeLabel = (mode: InterruptMode) =>
  mode === "immediate"
   ? t("workspace.queueInterruptImmediate")
   : t("workspace.queueInterruptWait");

 const modeHint = (mode: InterruptMode) =>
  mode === "immediate"
   ? t("workspace.queueInterruptImmediateHint")
   : t("workspace.queueInterruptWaitHint");

 return (
  <div className="mb-1.5 rounded-xl border border-border/70 bg-card/60 px-1.5 py-1">
   <div className="flex items-center gap-2 px-1 pt-0.5 text-ui-xs text-muted-foreground">
    <ListOrdered aria-hidden="true" className="size-3.5 shrink-0" />
    <span className="shrink-0 font-medium text-foreground">
     {t("workspace.queueTitle")}
    </span>
    <span className="shrink-0">
     {t("workspace.queueCount", { count: total })}
    </span>
    <span className="flex-1" />
    <span className="shrink-0">{t("workspace.queueInterrupt")}</span>
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5">
     {INTERRUPT_MODES.map((mode) => (
      <Tooltip key={mode}>
       <TooltipTrigger
        render={
         <Button
          aria-label={modeHint(mode)}
          aria-pressed={runtime.interruptMode === mode}
          onClick={() => void setInterruptMode(mode)}
          size="xs"
          type="button"
          variant={runtime.interruptMode === mode ? "outline" : "ghost"}
         />
        }
       >
        {modeLabel(mode)}
       </TooltipTrigger>
       <TooltipContent>
        <p>{modeHint(mode)}</p>
       </TooltipContent>
      </Tooltip>
     ))}
    </div>
   </div>

   {sections.map((section) =>
    section.items.length === 0 ? null : (
     <div className="mt-0.5" key={section.queue}>
      <div
       className="px-1 text-ui-xs text-muted-foreground/70"
       title={section.hint}
      >
       {section.label}
       <span className="ml-1 text-muted-foreground/50">
        {section.items.length}
       </span>
      </div>
      {section.items.map((text, index) => {
       const isDragging =
        dragging !== null &&
        dragging.queue === section.queue &&
        dragging.index === index;
       const isDropTarget =
        dragging !== null &&
        dragging.queue === section.queue &&
        dropIndex === index &&
        !isDragging;
       return (
        <div
         className={cn(
          "group/queue-row flex h-7 items-center gap-0.5 rounded-lg px-0.5 select-none transition-colors",
          isDragging ? "opacity-40" : "hover:bg-muted/40",
          isDropTarget && "bg-accent ring-2 ring-ring",
         )}
         key={`${section.queue}:${index}:${text}`}
         onDragOver={(event) => {
          if (dragging?.queue !== section.queue) {
           return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropIndex(index);
         }}
         onDrop={(event) => {
          event.preventDefault();
          const from =
           dragging !== null && dragging.queue === section.queue
            ? dragging.index
            : null;
          endDrag();
          if (from !== null) {
           void reorderQueued(section.queue, from, index);
          }
         }}
        >
         <span
          aria-hidden="true"
          className="flex size-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 active:cursor-grabbing"
          draggable
          onDragEnd={endDrag}
          onDragStart={(event) => {
           event.dataTransfer.effectAllowed = "move";
           event.dataTransfer.setData("text/plain", text);
           setDragging({ queue: section.queue, index });
           setDropIndex(index);
          }}
         >
          <GripVertical className="size-3" />
         </span>
         <span
          className="min-w-0 flex-1 truncate text-ui-sm"
          title={text}
         >
          {text}
         </span>

         {section.queue === "followUp" ? (
          <Button
           aria-label={t("workspace.queueSteerHint")}
           onClick={() => void steerQueued(text)}
           size="xs"
           title={t("workspace.queueSteerHint")}
           type="button"
           variant="ghost"
          >
           {t("workspace.queueSteer")}
          </Button>
         ) : null}
         <Button
          aria-label={t("workspace.queueEdit")}
          onClick={() => editQueued(text, section.queue)}
          size="icon-xs"
          title={t("workspace.queueEditHint")}
          type="button"
          variant="ghost"
         >
          <PenLine className="size-3" />
         </Button>
         <Button
          aria-label={t("workspace.queueDelete")}
          onClick={() => void removeQueued(text, section.queue)}
          size="icon-xs"
          title={t("workspace.queueDeleteHint")}
          type="button"
          variant="ghost"
         >
          <Trash2 className="size-3" />
         </Button>
        </div>
       );
      })}
     </div>
    ),
   )}
  </div>
 );
}
