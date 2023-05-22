# MusicPro-Rest

Rest API de MusicPro para certamen Integración de Plataformas. Integración con Transbank con NodeJS. SurrealDB como Base de Datos.

Por favor, para utilizar el proyecto copia el contenido de la carpeta `proyecto` y pégalo en cualquier otra carpeta en la cual quieras guardar el proyecto.

Para continuar, copia la carpeta `MusicPro.db` ubicada dentro de la carpeta db y pégalo en una nueva carpeta llamada `SurrealDB`, ubicada en el disco local C (`C:\`). Para este paso necesitas tener instalado [SurrealDB](https://surrealdb.com/install), puedes seguir las instrucciones de instalación escritas en la página, dependiendo de tu sistema operativo.

Ahora, abre un `cmd` y escribe el siguiente comando: `surreal start --user root --pass root file:C:\SurrealDB\MusicPro.db` esto iniciará el servidor de la base de datos con el usuario root, contraseña root y con el path `C:\SurrealDB\MusicPro.db`.

Por último, abre otro `cmd` en la carpeta del proyecto y ejecuta estos dos comandos: `npm install` y `node src/server.js`. Esto iniciará el servidor en local host, puerto 3000.
