-- Applied to production on 2026-09-13.
-- Administrative/internal RPCs should not be callable by visitors using the
-- public Supabase key. Customer-facing RPCs are intentionally not changed.

revoke execute on function public.aplica_estoque_pedido() from public, anon, authenticated;
revoke execute on function public.calcular_imposto_importacao(numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.conceder_admin(text) from public, anon, authenticated;
revoke execute on function public.revogar_admin(uuid) from public, anon, authenticated;
revoke execute on function public.conceder_permissao_fabrica(uuid) from public, anon, authenticated;
revoke execute on function public.revogar_permissao_fabrica(uuid) from public, anon, authenticated;
revoke execute on function public.listar_admins_admin() from public, anon, authenticated;
revoke execute on function public.listar_clientes_admin() from public, anon, authenticated;
revoke execute on function public.produtos_admin() from public, anon, authenticated;
revoke execute on function public.produto_por_link_fornecedor(text) from public, anon, authenticated;
revoke execute on function public.estatisticas_espaco_admin() from public, anon, authenticated;
revoke execute on function public.precos_fabrica_ativos() from public, anon, authenticated;
revoke execute on function public.cancelar_pedido_cliente(uuid) from public, anon, authenticated;
revoke execute on function public.criar_solicitacao_troca(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.enviar_avaliacao_cliente(uuid, uuid, integer, text, text[]) from public, anon, authenticated;
revoke execute on function public.criar_pedido(jsonb) from public, anon, authenticated;

grant execute on function public.conceder_admin(text) to authenticated;
grant execute on function public.revogar_admin(uuid) to authenticated;
grant execute on function public.conceder_permissao_fabrica(uuid) to authenticated;
grant execute on function public.revogar_permissao_fabrica(uuid) to authenticated;
grant execute on function public.listar_admins_admin() to authenticated;
grant execute on function public.listar_clientes_admin() to authenticated;
grant execute on function public.produtos_admin() to authenticated;
grant execute on function public.produto_por_link_fornecedor(text) to authenticated;
grant execute on function public.estatisticas_espaco_admin() to authenticated;
grant execute on function public.precos_fabrica_ativos() to authenticated;
grant execute on function public.cancelar_pedido_cliente(uuid) to authenticated;
grant execute on function public.criar_solicitacao_troca(uuid, text, text, text) to authenticated;
grant execute on function public.enviar_avaliacao_cliente(uuid, uuid, integer, text, text[]) to authenticated;
grant execute on function public.criar_pedido(jsonb) to authenticated;