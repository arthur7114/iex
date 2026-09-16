// `server-only` existe para quebrar o BUILD quando um módulo de servidor é
// importado por código de cliente. Fora do Next não há pacote a resolver, então
// o vitest aponta para este stub vazio — o guard continua valendo no build real.
export {}
