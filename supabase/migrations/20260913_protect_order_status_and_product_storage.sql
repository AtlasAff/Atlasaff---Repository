-- Applied to production on 2026-09-13.
-- Keeps a full order UUID from acting as a public read token and prevents
-- ordinary signed-in customers from modifying the public product-media bucket.

create or replace function public.status_pedido_publico(p_id uuid, p_email text)
returns table(
  id uuid, criado_em timestamp with time zone, status text, status_pagamento text,
  forma_pagamento text, subtotal numeric, frete numeric, desconto numeric,
  cupom_codigo text, total numeric, itens jsonb, nome_cliente text,
  codigo_rastreio text, transportadora_rastreio text, frete_prazo_dias integer,
  previsao_chegada_internacional date
)
language sql
stable
security definer
set search_path = public
as $$
  select id, criado_em, status, status_pagamento, forma_pagamento, subtotal,
         frete, desconto, cupom_codigo, total, itens, nome_cliente,
         codigo_rastreio, transportadora_rastreio, frete_prazo_dias,
         previsao_chegada_internacional
  from public.pedidos
  where id = p_id
    and lower(email_cliente) = lower(trim(coalesce(p_email, '')));
$$;

revoke execute on function public.status_pedido_publico(uuid) from public, anon, authenticated;
grant execute on function public.status_pedido_publico(uuid, text) to anon, authenticated;

drop policy if exists "Somente autenticados podem apagar fotos de produtos" on storage.objects;
drop policy if exists "Somente autenticados podem atualizar fotos de produtos" on storage.objects;
drop policy if exists "Somente autenticados podem enviar fotos de produtos" on storage.objects;

create policy "Só admin apaga fotos de produtos"
on storage.objects for delete to authenticated
using (bucket_id = 'produtos' and public.is_admin());

create policy "Só admin atualiza fotos de produtos"
on storage.objects for update to authenticated
using (bucket_id = 'produtos' and public.is_admin())
with check (bucket_id = 'produtos' and public.is_admin());

create policy "Só admin envia fotos de produtos"
on storage.objects for insert to authenticated
with check (bucket_id = 'produtos' and public.is_admin());

alter function public.calcular_imposto_importacao(numeric, numeric, numeric) set search_path = public;
alter function public.marca_pedido_entregue_em() set search_path = public;