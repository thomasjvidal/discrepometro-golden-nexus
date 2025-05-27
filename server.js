import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());
app.use(fileUpload());
app.use(cors());

// Rota de teste para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'Servidor do Discrepômetro funcionando!' });
});

// Rota para testar a conexão com o Supabase
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.from('test').select('*').limit(1);
    if (error) throw error;
    res.json({ message: 'Conexão com Supabase OK!', data });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao conectar com Supabase', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)); 