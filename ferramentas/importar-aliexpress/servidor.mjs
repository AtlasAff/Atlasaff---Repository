Warning: truncated output (original token count: 6615)
Total output lines: 564

// Servidor local da interface visual do importador de AliExpress — roda
// só na sua máquina (nada muda de segurança/privacidade em relação ao
// script de terminal: mesma sessão do AliExpress, mesmo Supabase, mesma
// chave do Groq — só ganha uma tela pra ver e editar tudo antes de
// publicar, em vez de responder perguntas no terminal às cegas).
//
// Como usar: depois de já ter ro…6415 tokens truncated…cal}`;
  try {
    const abertura = exec(comando, () => { /* se não conseguiu abrir sozinho, o usuário abre na mão mesmo */ });
    abertura.on('error', () => { /* abrir é só conveniência; o servidor segue normal */ });
  } catch {
    // Alguns ambientes bloqueiam a abertura automática. A interface continua
    // disponível no endereço mostrado acima, sem derrubar o servidor.
  }
});

