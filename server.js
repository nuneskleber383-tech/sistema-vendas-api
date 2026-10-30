require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// 1. Configuração da Conexão com o Banco de Dados (Pool)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Teste rápido da conexão ao iniciar
pool.getConnection()
    .then(connection => {
        console.log('📦 Conectado ao banco de dados MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    });

// ---------------------------------------------------------
// ROTAS DA API
// ---------------------------------------------------------

// 2. Rota GET /api/pedidos - Listar todos os pedidos (mais recentes primeiro)
app.get('/api/pedidos', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM pedidos ORDER BY id_pedido DESC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// 4. Rota GET /api/pedidos/:id - Detalhar um pedido específico com seus respectivos itens
app.get('/api/pedidos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Busca os dados do pedido
        const [pedidos] = await pool.query(
            'SELECT * FROM pedidos WHERE id_pedido = ?', 
            [id]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        const pedido = pedidos[0];

        // Busca os itens vinculados ao pedido, juntando com os dados do produto
        const [itens] = await pool.query(
            `SELECT ip.id, ip.produto_id, p.nome AS produto_nome, ip.quantidade, ip.preco_unitario 
             FROM itens_pedido ip 
             JOIN produtos p ON ip.produto_id = p.id 
             WHERE ip.id_pedido = ?`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ...pedido,
                itens
            }
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// 3. Rota PATCH /api/pedidos/:id - Atualizar o status do pedido (etapa_pedido ou status)
app.patch('/api/pedidos/:id', async (req, res) => {
    const { id } = req.params;
    const { etapa_pedido, status, aviso_entrega, observacao } = req.body;

    try {
        // Constrói dinamicamente os campos que serão atualizados para evitar sobrescrever com null
        const camposParaAtualizar = [];
        const valores = [];

        if (etapa_pedido !== undefined) {
            camposParaAtualizar.push('etapa_pedido = ?');
            valores.push(etapa_pedido);
        }
        if (status !== undefined) {
            camposParaAtualizar.push('status = ?');
            valores.push(status);
        }
        if (aviso_entrega !== undefined) {
            camposParaAtualizar.push('aviso_entrega = ?');
            valores.push(aviso_entrega);
        }
        if (observacao !== undefined) {
            camposParaAtualizar.push('observacao = ?');
            valores.push(observacao);
        }

        if (camposParaAtualizar.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nenhum campo válido fornecido para atualização.' 
            });
        }

        valores.push(id); // Adiciona o ID no final para a cláusula WHERE

        // CORREÇÃO AQUI: Uso de crases para a query dinâmica funcionar corretamente
        const camposStr = camposParaAtualizar.join(', ');
        const query = 'UPDATE pedidos SET ' + camposStr + ' WHERE id_pedido = ?';
        const [resultado] = await pool.query(query, valores);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        res.json({ 
            success: true, 
            message: 'Pedido atualizado com sucesso!' 
        });
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando na porta ${PORT}');
});
