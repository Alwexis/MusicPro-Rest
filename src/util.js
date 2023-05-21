class Util {
    /**
     * @param { object } rawQuery Objeto del Query String de una petición.
     * @returns { string } String con los campos del Query String de la petición parseados a una query de SQL.
     * @example { 'stock': '> 10', 'precio': '< 1000' }
     * @returns 'stock > 10 AND precio < 1000'
     */
    static parseQuery(rawQuery) {
        // Example of an expected result from the query string:
        //! stock > 10
        let parsedQuery = [];
        Object.keys(rawQuery).forEach(key => {
            if (rawQuery[key].startsWith('>') || rawQuery[key].startsWith('<') || rawQuery[key].startsWith('=>') || rawQuery[key].startsWith('=<')) {
                parsedQuery.push(`${key} ${rawQuery[key]}`);
            } else if (key == 'id' && !rawQuery[key].startsWith('producto:')) {
                parsedQuery.push(`${key} = producto:${rawQuery[key]}`);
            } else if (key == 'in') {
                let parsedInQuery = rawQuery[key].split(';').map(value => `'${value}'`).join(', ');
                parsedQuery.push(`id IN [${parsedInQuery}]`);
            } else {
                parsedQuery.push(`${key} = ${rawQuery[key]}`);
            }
        });
        return parsedQuery.join(' AND ');
    }

    /**
     * @param { object } rawBody Objeto del Body de una petición.
     * @returns { object } Objeto con los campos del Body de la petición parseados a su tipo de dato correspondiente.
     * @example { 'stock': '10', 'precio': '1000' }
     * @returns { stock: 10, precio: 1000 }
     */
    static parseBody(rawBody) {
        let parsedBody = {};
        Object.keys(rawBody).forEach(key => {
            // Utilizaremos regular expressions para determinar el tipo de dato de cada campo del body.
            if (/^-?\d+$/.test(rawBody[key])) {
                parsedBody[key] = parseInt(rawBody[key]);
            } else if (/^-?\d+(\.\d+)?$/.test(rawBody[key])) {
                parsedBody[key] = parseFloat(rawBody[key]);
            } else if (rawBody[key] === 'true' || rawBody[key] === 'false') {
                parsedBody[key] = rawBody[key] === 'true';
                // Just in case we're using a Transaction
            } else {
                parsedBody[key] = rawBody[key];
            }
        });
        return parsedBody;
    }

    /**
     * @param { boolean } isBuyOrder Booleano que determina si la orden es de compra o de venta.
     * @returns { string } String con el UUID generado.
     */
    static generateCustomUUID(isBuyOrder) {
        const limit = isBuyOrder ? 26 : 61;
        const regex = /[a-zA-Z0-9_~-]/;
        let customUUID = '';
        for (let i = 0; i < limit; i++) {
            let randomChar = '';
            do {
                const randomIndex = Math.floor(Math.random() * 128);
                randomChar = String.fromCharCode(randomIndex);
            } while (!regex.test(randomChar) || randomChar === ' ');
            /*
            ! O30ACufvNNeEor32FDQ8ebrHtTYwAaWmQ1c2NCtU2JCg8GlGYLeA9AdmbduGR
            ? O30ACufvNNeEor32FDQ8ebrHtTYwAaWmQ1c2NCtU2JCg8GlGYLeA9AdmbduGR
            */
            customUUID += randomChar;
        }
        return encodeURIComponent(customUUID);
    }

}

module.exports = Util;