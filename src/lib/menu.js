import { api } from "./api.js";

/* Cardápio padrão — usado pelo botão "Restaurar original" do admin
   (mesma semente do server/schema.sql). */
export const DEFAULT_MENU = {
  categorias: [
    {
      nome: "Salgados",
      tema: "verde-escuro",
      itens: [
        { nome: "Pão com pernil", desc: "", preco: 25.0 },
        { nome: "Pastel self-service", desc: "Monte do seu jeito", preco: 17.0 },
        { nome: "Batata frita", desc: "Com bacon e cheddar", preco: 15.5 },
        { nome: "Salsichão", desc: "", preco: 8.0 },
        { nome: "Coxinha", desc: "Frango", preco: 8.0 },
        { nome: "Cachorro quente self-service", desc: "Monte do seu jeito", preco: 15.0 },
        { nome: "Caldo 250ml", desc: "Frango", preco: 8.0 },
        { nome: "Caldo 500ml", desc: "Frango", preco: 15.0 },
      ],
    },
    {
      nome: "Bebidas",
      tema: "laranja",
      itens: [
        { nome: "Refrigerante 200ml", desc: "", preco: 3.0 },
        { nome: "Suco 200ml", desc: "", preco: 3.5 },
        { nome: "Água sem gás", desc: "", preco: 2.5 },
        { nome: "Água com gás", desc: "", preco: 3.0 },
      ],
    },
    {
      nome: "Doces",
      tema: "verde-claro",
      itens: [
        { nome: "Bala", desc: "", preco: 0.2 },
        { nome: "Fruit-tella", desc: "", preco: 3.5 },
        { nome: "Halls", desc: "", preco: 2.5 },
        { nome: "Prestígio", desc: "", preco: 4.0 },
        { nome: "Kit Kat", desc: "", preco: 4.5 },
        { nome: "Trento", desc: "", preco: 3.5 },
        { nome: "Trident", desc: "", preco: 3.0 },
        { nome: "Mentos", desc: "", preco: 3.5 },
      ],
    },
  ],
};

export const loadMenu = () => api.get("/api/cardapio/menu");

export const saveMenu = (menu) => api.put("/api/cardapio/menu", menu);

/* Cria o pedido no servidor e devolve o número único.
   payload: { nome, email, telefone, total, itens:[ {nome, preco, qty, sub} ] } */
export const createOrder = (payload) => api.post("/api/cardapio/orders", payload);
