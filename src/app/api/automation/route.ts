import { NextResponse } from 'next/server';
import { runMoveAutomation } from '@/lib/automation/move-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const body = await req.json().catch(() => ({}));
  const project = body.project ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (message: string, data?: Record<string, unknown>) => {
        const payload = JSON.stringify({ message, ...data });
        controller.enqueue(encoder.encode(payload + '\n'));
      };

      try {
        const result = await runMoveAutomation(project, (msg) => {
          sendUpdate(msg);
        });

        if (result.success) {
          sendUpdate('Automação concluída com sucesso!', {
            success: true,
            report: result.report,
            status: 'success'
          });
        } else {
          sendUpdate(result.error || 'Erro na automação', {
            success: false,
            details: result.details,
            status: 'error'
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro desconhecido';
        sendUpdate('Erro fatal na automação: ' + msg, { success: false, status: 'error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
