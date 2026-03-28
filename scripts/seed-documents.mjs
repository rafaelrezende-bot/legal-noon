import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ftypkharlbplxrqlbeid.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const data = JSON.parse(readFileSync(new URL('../policy_documents_seed.json', import.meta.url), 'utf-8'));

console.log(`🌱 Seeding ${data.length} documents...`);

for (const doc of data) {
  const { error } = await supabase.from('policy_documents').upsert(
    {
      name: doc.name,
      filename: doc.filename,
      category: doc.category,
      content: doc.content,
      pages: doc.pages,
      storage_path: null,
    },
    { onConflict: 'name' }
  );

  if (error) {
    console.error(`  ✗ ${doc.name}: ${error.message}`);
  } else {
    console.log(`  ✓ ${doc.name} (${doc.pages} pages)`);
  }
}

console.log('✅ Done');
