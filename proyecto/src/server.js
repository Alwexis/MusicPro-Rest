//! Leer Documentación de bcryptjs y uuid
//? Comando para iniciar la base de datos de SurrealDB
// surreal start --user root --pass root file:C:\SurrealDB\MusicPro.db

//! Para pagar con transbank utiliza las siguientes tarjetas:

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const WebpayPlus = require('transbank-sdk').WebpayPlus;
// const YAML = require('yamljs');
const DB = require('./db.js');
const Util = require('./util.js');
const Swagger = require('./swagger.js');

dotenv.config();
const app = express();
app.enable('trust proxy');

// Utilizamos CORS para evitar problemas de Origenes Cruzados.
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
// Swagger
const { serve, setup } = Swagger.setup();
app.use("/docs", serve, setup);
const port = process.env.PORT || 3000;

// Iniciamos la Base de Datos
var _DB = new DB();

app.get(/\/$|api-docs/, (req, res) => {
    res.redirect('/docs');
});

app.get('/api/producto', async (req, res) => {
    let productos = Object.keys(req.query).length > 0 ? await _DB.getProducto(req.query) : await _DB.getProductos();
    res.status(200).json(productos)
});

// crear producto
app.post('/api/producto', async (req, res) => {
    if (req.body) {
        const _REQUIRED_FIELDS = ['categoria', 'descripcion', 'nombre', 'precio', 'stock'];
        let bodyKeys = Object.keys(req.body);
        let missedFields = _REQUIRED_FIELDS.filter(field => !bodyKeys.includes(field));
        if (missedFields.length === 0) {
            try {
                let parsedBody = Util.parseBody(req.body);
                let createdProduct = await _DB.createProducto(parsedBody);
                return res.status(201).send(JSON.stringify(createdProduct));
            } catch (e) {
                return res.status(500).send(JSON.stringify({ error: e.message }));
            }
        }
        return res.status(400).send(JSON.stringify({ error: `No se han especificado todos los campos. Campos no especificados en la petición: ${missedFields.join(', ')}.` }));
    }
    return res.status(400).send(JSON.stringify({ error: 'Los campos del producto deben ser especificados en el Body. Campos a especificar: CATEGORIA, DESCRIPCION, NOMBRE, PRECIO, STOCK.' }));
});

app.put('/api/producto', async (req, res) => {
    if (req.body) {
        if (!req.query.id) return res.status(400).send(JSON.stringify({ error: 'No se ha especificado el ID del producto a actualizar.' }));

        const POSSIBLE_FIELDS = ['categoria', 'descripcion', 'nombre', 'precio', 'stock'];
        let bodyKeys = Object.keys(req.body);
        let wrongFields = bodyKeys.filter(field => !POSSIBLE_FIELDS.includes(field));
        if (wrongFields.length === 0) {
            try {
                let parsedBody = Util.parseBody(req.body);
                let id = req.query.id;
                if (!id.startsWith('producto:')) {
                    id = `producto:${id}`;
                }
                let updatedProduct = await _DB.updateProducto(id, parsedBody);
                return res.status(200).send(JSON.stringify(updatedProduct));
            } catch (e) {
                return res.status(500).send(JSON.stringify({ error: e.message }));
            }
        }
        return res.status(400).send(JSON.stringify({ error: `Se han especificado campos inválidos. Campos inválidos especificados en la petición: ${wrongFields.join(', ')}.` }));
    }
});

/*
? Ejemplo de una petición para /api/pedido mediante un cliente Browser
* await fetch('http://127.0.0.1:3000/api/pedido',
* {
*     headers: {
*         'Content-Type': 'application/json',
*     },
*     method: 'POST',
*     body: '{"cliente":20919721,"productos":["producto:79tz20fzo8llfp61rxrq","producto:mxnfemaf1i5t2dsdi3qw"]}'
* });
? Ejemplo de una petición para /api/pedido mediante un cliente HTTP (Postman, Insomnia, etc)
! BODY
* {
*     "cliente": 20919721,
*     "productos": [
*         "producto:79tz20fzo8llfp61rxrq",
*         "producto:mxnfemaf1i5t2dsdi3qw"
*     ]
* }
*/

//crear pedido
app.post('/api/pedido', async (req, res) => {
    if (req.body) {
        const _REQUIRED_FIELDS = ['cliente', 'productos'];
        let bodyKeys = Object.keys(req.body);
        let missedFields = _REQUIRED_FIELDS.filter(field => !bodyKeys.includes(field));
        if (missedFields.length === 0) {
            if (req.body.productos.length > 0) {
                try {
                    let cliente = req.body.cliente;
                    let productos = req.body.productos.join(';')
                    let productosObject = await _DB.getProducto({ in: productos });
                    let total = productosObject.reduce((acc, curr) => acc + curr.precio, 0);
                    let buyOrder = Util.generateCustomUUID(true);
                    let sessionID = Util.generateCustomUUID(false);

                    await _DB.setupTransaction({ buyOrder, sessionID, cliente, productosObject, total });
                    //? Transacción con Webpay
                    return res.status(308).redirect(`/transaccion?buyOrder=${buyOrder}&sessionID=${sessionID}`)
                } catch (e) {
                    return res.status(500).send(JSON.stringify({ error: e.message }));
                }
            }
            return res.status(400).send(JSON.stringify({ error: 'No se han especificado productos en el pedido.' }));
        }
        return res.status(400).send(JSON.stringify({ error: `No se han especificado todos los campos. Campos no especificados en la petición: ${missedFields.join(', ')}.` }));
    }
});

//obtener las transacciones
app.get('/transaccion', async (req, res) => {
    try {
        if (!req.query.buyOrder || !req.query.sessionID) throw new Error('No se han especificado los parámetros necesarios para la transacción.');

        let { buyOrder, sessionID } = req.query;
        buyOrder = decodeURIComponent(buyOrder);
        sessionID = decodeURIComponent(sessionID);

        const preTransaction = await _DB.getPreTransactionData(buyOrder, sessionID);
        if (!preTransaction) throw new Error('No se ha encontrado la transacción especificada.');

        let total = preTransaction.total;
        let cliente = preTransaction.cliente;
        let productos = preTransaction.productosObject;

        const { token, url } = await (new WebpayPlus.Transaction()).create(
            buyOrder,
            sessionID,
            total, // Monto en pesos chilenos
            'http://127.0.0.1:3000/transaccion/committed',
        );
        //? De esta manera (con el SDK) la transacción se concreta de manera correcta utilizando
        //? credenciales generadas por defecto por Transbank, por lo que no permite al cliente escoger
        //? sus tarjetas, ni nada.
        // const committedTransaction = await (new WebpayPlus.Transaction()).commit(token);
        // console.log(committedTransaction);
        // res.status(200).json({ token, url });
        res.render('home', { token, url, total, cliente, productos });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
})

// Confirmación del pago
app.get('/transaccion/committed', async (req, res) => {
    const info = await (new WebpayPlus.Transaction()).status(req.query.token_ws);
    const { buy_order, session_id, status, transaction_date, card_detail, payment_type_code } = info;

    const preTransaction = await _DB.getPreTransactionData(buy_order, session_id);
    preTransaction.estado = status;
    preTransaction.fecha = transaction_date;
    preTransaction.tarjeta = card_detail.card_number;
    preTransaction.productos = preTransaction.productosObject.map(producto => producto.id);
    delete preTransaction.productosObject;
    const paymentTypes = { VD: 'Venta Débito', VN: 'Venta Normal', VC: 'Venta en cuotas', SI: '3 cuotas sin interés', S2: '2 cuotas sin interés', NC: 'N cuotas sin interés', VP: 'Venta Prepago' };
    preTransaction.tipo = paymentTypes[payment_type_code];

    const transaction = await _DB.createTransaction(preTransaction);
    res.status(201).send('Transacción Completada')
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`La API está escuchando en http://localhost:${port}`);
});