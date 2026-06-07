import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    // Retrieve the public URL for active_targets.mind in the 'memories' bucket
    const { data } = supabase.storage.from('memories').getPublicUrl('targets/active_targets.mind');
    
    if (!data?.publicUrl) {
      return NextResponse.json({ error: 'Target file URL not generated' }, { status: 404 });
    }

    // Fetch the target file server-side (bypasses CORS restrictions in the client)
    const response = await fetch(data.publicUrl, {
      headers: {
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Compiled target file not found on Storage' }, { status: response.status });
    }

    const fileBuffer = await response.arrayBuffer();

    // Stream the binary data back to the client
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Error proxying target file:', err);
    return NextResponse.json({ error: 'Internal server error while retrieving target file' }, { status: 500 });
  }
}
