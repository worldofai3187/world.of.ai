'use client';

import { useState, useEffect } from 'react';
import { supabase, type Agent, type FileEntry } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Upload, FileText, Image, File, Loader2, Trash2 } from 'lucide-react';

function fileIcon(mime: string | null) {
  if (mime?.startsWith('image/')) return Image;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesApp({ agent }: { agent: Agent }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [mime, setMime] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('files').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false });
    setFiles((data || []) as FileEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agent.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('files').insert({
      agent_id: agent.id,
      name,
      size: parseInt(size) || 0,
      mime_type: mime || 'application/octet-stream',
      storage_path: `agents/${agent.id}/${name}`,
    });
    setName(''); setSize(''); setMime('');
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('files').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Files</h3>

      <Card className="glass border-border/50 p-4 space-y-3">
        <form onSubmit={handleAdd} className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" /> Register a file</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="document.pdf" required />
          <div className="flex gap-2">
            <Input value={size} onChange={(e) => setSize(e.target.value)} type="number" placeholder="Size (bytes)" className="flex-1" />
            <Input value={mime} onChange={(e) => setMime(e.target.value)} placeholder="application/pdf" className="flex-1" />
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add File'}
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No files stored.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
          {files.map((f) => {
            const Icon = fileIcon(f.mime_type);
            return (
              <Card key={f.id} className="glass border-border/50 p-2.5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <Badge variant="outline" className="text-xs">{formatSize(f.size)}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="h-8 w-8 shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
