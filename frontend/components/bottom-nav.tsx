"use client"
import { FileText, Calendar, Wrench, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav({ activeTab, onTabChange }: { activeTab: string, onTabChange: (id: string) => void }) {
    const tabs = [
        { id: "itinerary", label: "Itinerary", icon: Calendar },
        { id: "info", label: "Info", icon: FileText }, // 👈 改這裡：Map -> Info
        { id: "tools", label: "Tools", icon: Wrench },
        { id: "profile", label: "Profile", icon: User },
    ]
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1",
                            activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-5 h-5" strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}