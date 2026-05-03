export type CryptoCoin = {
  id: string;
  symbol: string;
  name: string;
  image_url: string;
  price: number;
  change_24h: number;
  volatility: number;
  market_cap: number | null;
  active: boolean;
  created_at: string;
};

export type CryptoHolding = {
  id: string;
  username: string;
  coin_id: string;
  amount: number;
  avg_price: number;
  updated_at: string;
};
