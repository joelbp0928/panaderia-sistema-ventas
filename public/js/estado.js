// estado.js
export let clienteActivo = false;

export function setClienteActivo(valor) {
  clienteActivo = valor;
}

export function getClienteActivo() {
  return clienteActivo;
}
