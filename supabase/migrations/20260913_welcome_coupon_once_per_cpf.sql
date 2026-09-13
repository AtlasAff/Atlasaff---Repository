begin;

create table if not exists public.cupom_usos_por_cpf (
  cupom_id uuid not null references public.cupons(id) on delete cascade,
  cpf_cliente text not null check (cpf_cliente ~ '^[0-9]{11}$'),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (cupom_id, cpf_cliente)
);

alter table public.cupom_usos_por_cpf enable row level security;
revoke all on table public.cupom_usos_por_cpf from public, anon, authenticated;

create or replace function public.registrar_uso_unico_cupom_bem_vindo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cupom_id uuid;
begin
  if new.cupom_codigo is null then
    return new;
  end if;

  select id
    into v_cupom_id
    from public.cupons
   where upper(codigo) = upper(new.cupom_codigo)
     and ativo = true
     and exibir_popup = true;

  if v_cupom_id is null then
    return new;
  end if;

  insert into public.cupom_usos_por_cpf (cupom_id, cpf_cliente, pedido_id)
  values (v_cupom_id, new.cpf_cliente, new.id);

  return new;
exception
  when unique_violation then
    raise exception 'Esse cupom de boas-vindas já foi usado com este CPF.'
      using errcode = 'P0001';
end;
$$;

revoke all on function public.registrar_uso_unico_cupom_bem_vindo() from public, anon, authenticated;

drop trigger if exists pedidos_registram_uso_unico_cupom_bem_vindo on public.pedidos;
create trigger pedidos_registram_uso_unico_cupom_bem_vindo
  after insert on public.pedidos
  for each row
  execute function public.registrar_uso_unico_cupom_bem_vindo();

-- O limite global sai: a unicidade cupom + CPF é a trava real.
update public.cupons
   set uso_maximo = null
 where ativo = true
   and exibir_popup = true;

commit;

