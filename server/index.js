require('dotenv/config');
const express = require('express');

const db = require('./database');
const ClientError = require('./client-error');
const staticMiddleware = require('./static-middleware');
const sessionMiddleware = require('./session-middleware');

const app = express();

app.use(staticMiddleware);
app.use(sessionMiddleware);

app.use(express.json());

app.get('/api/health-check', (req, res, next) => {
  db.query('select \'successfully connected\' as "message"')
    .then(result => res.json(result.rows[0]))
    .catch(err => next(err));
});

app.get('/api/products', (req, res, next) => {
  const viewAllProducts = `
   SELECT *
     FROM "products"
  `;
  db.query(viewAllProducts)
    .then(result => res.json(result.rows))
    .catch(err => next(err));

});

app.get('/api/products/:productId', (req, res, next) => {
  const viewSingleProduct = `
   SELECT *
     FROM "products"
     WHERE "productId" = $1
  `;
  const productId = parseInt(req.params.productId);
  const params = [productId];

  db.query(viewSingleProduct, params)
    .then(result => {
      if (!result.rows[0]) {
        res.status(404).json({
          error: `productId: ${productId} cannot be located.`
        });
      } else {
        res.json(result.rows[0]);
      }
    }).catch(err => next(err));
});

app.get('/api/cart', (req, res, next) => {
  // TAKING THIS OUT STOPPED THE ERRORS REGARDING SETTING HEADERS
  // if (!req.session.cartId === true) {
  //   res.json([]);

  // }
  const checkCartId = `
SELECT "c"."cartItemId",
       "c"."price",
       "p"."productId",
       "p"."image",
       "p"."name",
       "p"."shortDescription"
  FROM "cartItems" as "c"
  JOIN "products" as "p" USING ("productId")
 WHERE "c"."cartId" = $1
  `;
  const value = [req.session.cartId];

  db.query(checkCartId, value)
    .then(result => {
      const data = result.rows;
      res.json(data);
    })
    .catch(err => next(err));
});

app.post('/api/cart', (req, res, next) => {
  const { productId } = req.body;

  if (!Number(productId)) {
    return next(new ClientError(`${productId} is not a valid Product ID`, 400));
  }

  const checkPrice = `
  SELECT "price"
  FROM   "products"
  WHERE  "productId" = $1
`;

  const value = [productId];

  db.query(checkPrice, value)
    .then(result => {
      if (!result.rows[0]) {
        throw new ClientError(`productId ${productId} does not exist`, 400);
      } else if ('cartId' in req.session) {

        return {
          price: result.rows[0].price,
          cartId: req.session.cartId
        };
      }
      const addCartId = `
          INSERT INTO "carts" ("cartId", "createdAt")
          VALUES (default, default)
          RETURNING "cartId"
        `;
      return db.query(addCartId).then(cartId => ({
        price: result.rows[0].price,
        cartId: cartId.rows[0].cartId
      }));
    })
    .then(data => {
      req.session.cartId = data.cartId;
      const price = data.price;
      const addItemToCart = `
        INSERT INTO "cartItems" ("cartId", "productId", "price")
        VALUES ($1, $2, $3)
        RETURNING "cartItemId"
      `;
      const values = [data.cartId, productId, price];
      return db.query(addItemToCart, values).then(cartItemId => cartItemId.rows[0]);
    })
    .then(cartItemId => {

      const selectAllCartItems = `
  SELECT "c"."cartItemId",
      "c"."price",
      "p"."productId",
      "p"."image",
      "p"."name",
      "p"."shortDescription"
   FROM "cartItems" AS "c"
   JOIN "products" AS "p" using ("productId")
  WHERE "c"."cartItemId" = $1
      `;
      const value = [cartItemId.cartItemId];
      return db.query(selectAllCartItems, value)
        .then(data => {
          res.status(201).json(data.rows);
        });
    })
    .catch(err => next(err));
});

// Add GET request to get the cart quantity

app.get('/api/cart/quantity', (req, res, next) => {
  const getCartQuantity = `
      SELECT  "p"."productId",
              "p"."name",
              "p"."price",
              "p"."image",
              count("p"."productId")
        FROM  "products" as "p"
        JOIN  "cartItems" as "c" using ("productId")
       WHERE  "c"."cartId" = $1
    GROUP BY  "p"."productId"
  `;
  const cartId = [req.session.cartId];
  db.query(getCartQuantity, cartId)
    .then(result => res.status(200).json(result.rows))
    .catch(err => next(err));
});

// End GET request

// Add 2 DELETE requests to handle delete product and delete cart item

app.delete('/api/cart/:productId', (req, res, next) => {
  const { productId } = req.params;
  if (isNaN(productId)) {
    return res.status(400).json({
      error: 'Product Id must be a valid number'
    });
  }
  const sql = `
    DELETE FROM "cartItems"
        WHERE "cartId" = $1
          AND "productId" = $2
    RETURNING *
    `;
  const value = [req.session.cartId, productId];
  db.query(sql, value)
    .then(result => {
      if (!result.rows[0]) {
        res.status(404).json({
          error: 'Product Id does not exist.'
        });
      } else {
        res.status(200).json(result.rows);
      }
    })
    .catch(err => next(err));
});

app.delete('/api/cartItem/:cartItemId', (req, res, next) => {
  const { cartItemId } = req.params;
  if (isNaN(cartItemId)) {
    return res.status(400).json({
      error: 'Cart Item Id must be a valid number'
    });
  }
  const sql = `
    DELETE FROM "cartItems"
        WHERE "cartId" = $1
          AND "cartItemId" = $2
    RETURNING *
    `;
  const value = [req.session.cartId, cartItemId];
  db.query(sql, value)
    .then(result => {
      if (!result.rows[0]) {
        res.status(404).json({
          error: 'Cart Item Id does not exist.'
        });
      } else {
        res.status(200).json(result.rows);
      }
    })
    .catch(err => next(err));
});

app.post('/api/orders', (req, res, next) => {
  if (!req.session.cartId) {
    return res.status(400).json({
      error: 'There is no cartId in req.session'
    });
  }

  const { name, number, address } = req.body;

  if (!name || !number || !address) {
    return res.status(400).json({
      error: 'The request needs to contain a name, credit card number and shipping address.'
    });
  }
  const addNewOrder = `
    INSERT INTO "orders" ("orderId", "cartId", "name", "creditCard", "shippingAddress", "createdAt")
    VALUES (default, $1, $2, $3, $4, default)
    RETURNING *;
  `;
  const values = [req.session.cartId, name, number, address];

  db.query(addNewOrder, values)
    .then(result => {
      delete req.session.cartId;
      res.status(201).json(result.rows[0]);
    })
    .catch(err => next(err));
});

app.use('/api', (req, res, next) => {
  next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
});

app.use((err, req, res, next) => {
  if (err instanceof ClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({
      error: 'an unexpected error occurred'
    });
  }
});

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port', process.env.PORT);
});
