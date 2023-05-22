const swaggerUI = require("swagger-ui-express");
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./docs.yml');

class Swagger {

    static setup() {
        const options = {
            customSiteTitle: "MusicPro API"
        }
        return { serve: swaggerUI.serve, setup: swaggerUI.setup(swaggerDocument, options) }
    }
}

module.exports = Swagger;