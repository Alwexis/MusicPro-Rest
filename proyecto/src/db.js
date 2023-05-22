// import { Surreal } from "surrealdb.js";
const { default: Surreal } = require('surrealdb.js');
const Util = require('./util.js');

class DB {
    _db;

    constructor() {
        this._db = new Surreal('http://127.0.0.1:8000/rpc');
        this.setup();
    }

    /**
     * @returns { Promise<void> } Retorna una promesa que se resuelve cuando la base de datos se ha iniciado correctamente. 
     */
    async setup() {
        try {
            await this._db.signin({
                user: 'root',
                pass: 'root'
            });

            await this._db.use('MusicPro', 'MusicPro');
            // Revisamos si existe la Tabla Producto
            let producto = await this._db.select('producto');
            if (producto.length === 0) {
                await this._db.create('producto', {
                    nombre: 'Guitarra Eléctrica',
                    precio: 160000,
                    stock: 10,
                    descripcion: 'Guitarra Eléctrica de 6 cuerdas',
                    categoria: 'Guitarras'
                });
                console.log('Tabla Producto creada con un producto de ejemplo');
            }
            console.log('Base de Datos iniciada.');
        } catch(e) {
            return e;
        }
    }

    /**
     * @returns { Promise<Array> } Retorna un Array de Objetos siendo estos el resultado de la query.
     */
    async getProductos() {
        let productos = await this._db.select('producto');
        return productos;
    }

    /**
     * @param { object } rawQuery Objeto de la Query sin parsear.
     * @returns { Promise<object | Array> } Retorna un Array de Objetos siendo estos el resultado de la query. En caso de que se haya escogido una paginación, se devuelve un objeto con la página, paginación por y el resultado.
     */
    async getProducto(rawQuery) {
        //? Pagination. Por defecto 10 por página
        let shouldAddPagination = ''; let paginationValue = 0; let shouldAddPage = ''; let pageNumberValue = 0;
        if (rawQuery['paginated-by']) {
            shouldAddPagination = `LIMIT ${rawQuery['paginated-by']}`;
            paginationValue = parseInt(rawQuery['paginated-by']);
            delete rawQuery['paginated-by'];
            
            if (rawQuery['page']) {
                /*
                ? 20 por pagina
                ? formula para empezar = (page * 20) - 20
                ? Ya que si se empieza en la página 2, el inicio no sería 0, sino 20.
                ? por ende, 2 * 20 = 40 y 40 - 20 = 20.
                */
                let formulaResult = (parseInt(rawQuery['page']) * paginationValue) - paginationValue;
                if (formulaResult < 0) formulaResult = 0;
                shouldAddPage = `START ${formulaResult}`;
                pageNumberValue = parseInt(rawQuery['page']);
                delete rawQuery['page'];
            } else {
                shouldAddPage = `START 0`;
                pageNumberValue = 0;
            }
        }
        //? Revisamos si es que existe un query además de la paginación.
        let query = Util.parseQuery(rawQuery);
        let shouldAddQuery = '';
        if (query) shouldAddQuery = `WHERE ${query}`;
        
        let result = (await this._db.query(`SELECT * FROM producto ${shouldAddQuery} ${shouldAddPagination} ${shouldAddPage}`))[0].result;
        let resultPaginationObject = { paginated_by: paginationValue, page: pageNumberValue, next_page: pageNumberValue + 1, result: result };
        if (pageNumberValue > 1) resultPaginationObject.previous_page = pageNumberValue - 1;
        
        return (shouldAddPage !== '' && shouldAddPagination !== '') ? resultPaginationObject : result;
    }

    /**
     * @param { object } producto El objeto del producto a crear sin su ID.
     * @returns { Promise<object> } Retorna un objeto con el producto creado.
     */
    async createProducto(producto) {
        let createdProducto = await this._db.create('producto', producto);
        return createdProducto[0];
    }

    /**
     * @param { string } id Identificador del producto a actualizar 
     * @param { object } producto Objeto del producto con los datos a actualizar.
     * @returns { Promise<object> } Retorna un objeto con el producto actualizado.
     */
    async updateProducto(id, producto) {
        let updatedProducto = await this._db.update(id, producto);
        return { process: 'complete', result: updatedProducto };
    }

    /**
     * @param { object } data Objeto con los datos de la transacción (buyOrder, sessionID, cliente, productosObject, total).
     * @returns { Promise<object> } Retorna un objeto con los datos de la transacción.
     */
    async setupTransaction(data) {
        for (producto in data.productosObject) {
            if (producto.stock < 1) everyProductHasStock = false;
            throw new Error(`No hay stock en el producto ${producto.nombre} con la ID ${producto.id}`);
        }
        let transactionData = await this._db.create('preTransaccion', data);
        return transactionData[0];
    }

    /**
     * @param { string } buyOrder Orden de compra de la transacción.
     * @param { string } sessionId ID de la sesión de la transacción.
     * @returns { Promise<object> } Retorna un objeto con los datos de la transacción.
     */
    async getPreTransactionData(buyOrder, sessionId) {
        let transactionData = await this._db.query(`SELECT * FROM preTransaccion WHERE buyOrder = '${buyOrder}' AND sessionID = '${sessionId}' LIMIT 1`);
        return transactionData[0].result[0];
    }

    /**
     * @param { object } data Objeto con los datos de la transacción (buy_order, session_id, status, transaction_date, card_detail, payment_type_code, productos).
     * @returns { Promise<object> } Retorna un objeto con los datos de la transacción.
     */
    async createTransaction(data) {
        await this._db.delete(data['id']);
        delete data['id'];
        data.productos.forEach(async (id) => {
            let producto = (await this.getProducto({ id: id }))[0];
            producto.stock -= 1;
            let productoActualizado = await this.updateProducto(id, producto);
        })
        let transaction = await this._db.create('transaccion', data);
        return transaction[0];
    }
}

module.exports = DB;