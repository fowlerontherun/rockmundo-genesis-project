import { useParams } from "react-router-dom";
import { FestivalSessionWorkspace } from "@/components/festivals/performance/FestivalSessionWorkspace";
export default function FestivalSessionPage() { const { sessionId } = useParams(); if (!sessionId) return <div className="p-6">Missing session id.</div>; return <main className="container mx-auto p-4"><FestivalSessionWorkspace sessionId={sessionId} /></main>; }
