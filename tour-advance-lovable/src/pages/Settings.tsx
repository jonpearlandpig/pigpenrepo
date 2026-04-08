// Role management — assign PM / TM / VIEWER roles to team members
import { useEffect, useState } from "react";
import { Loader2, UserCheck, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Layout } from "@/components/Layout";

interface TapsUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

const ROLES = ["ADMIN", "PM", "TM", "VIEWER"] as const;
const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Full access — manage tours, lock AKB, assign roles",
  PM: "Upload riders, lock AKB, upload tech packets, resolve gaps",
  TM: "Upload tech packets, view and resolve gaps",
  VIEWER: "Read-only — view tours, venues, and gap reports",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-950/50 text-purple-300 border-purple-800/50",
  PM: "bg-amber-950/50 text-amber-300 border-amber-800/50",
  TM: "bg-blue-950/50 text-blue-300 border-blue-800/50",
  VIEWER: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export default function Settings() {
  const [users, setUsers] = useState<TapsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("users").select("*").order("created_at").then(({ data }) => {
      setUsers(data ?? []);
      setLoading(false);
    });
  }, []);

  async function updateRole(userId: string, role: string) {
    setSaving(userId);
    const { data } = await supabase.from("users").update({ role }).eq("id", userId).select().single();
    if (data) setUsers((prev) => prev.map((u) => u.id === userId ? data : u));
    setSaving(null);
  }

  return (
    <Layout breadcrumbs={[{ label: "Settings" }]}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-100">Team &amp; Roles</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage who can access TAPS and what they can do.
          </p>
        </div>

        {/* Role reference */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {ROLES.map((r) => (
            <div key={r} className={`border rounded-lg p-3 ${ROLE_COLORS[r]}`}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={12} />
                <span className="text-xs font-bold">{r}</span>
              </div>
              <p className="text-[11px] opacity-70">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>

        {/* Users table */}
        {loading ? (
          <div className="flex justify-center py-12 text-zinc-600">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">Joined</th>
                  <th className="text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-xs font-semibold">
                            {(user.name ?? user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{user.name ?? "—"}</p>
                          <p className="text-xs text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value)}
                          className={`text-xs font-medium border rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer ${ROLE_COLORS[user.role]} bg-transparent`}
                        >
                          {ROLES.map((r) => <option key={r} value={r} className="bg-zinc-900 text-zinc-200">{r}</option>)}
                        </select>
                        {saving === user.id && <Loader2 size={12} className="text-zinc-500 animate-spin" />}
                        {saving !== user.id && user.role !== "VIEWER" && <UserCheck size={12} className="text-zinc-600" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-zinc-600 mt-4">
          Users are added automatically when they sign in with Google for the first time.
          New users default to VIEWER until assigned a role here.
        </p>
      </div>
    </Layout>
  );
}
