
require('dotenv').config();
const express = require('express');
const logger = require('morgan');
const mongoose = require('mongoose');
var cheerio = require("cheerio");
var axios = require("axios");
var exphbs = require("express-handlebars");
var fs = require("fs");

// Require all models
const db = require('./models');

const PORT = process.env.PORT || 3000;

// Initialize Express
const app = express();

//  Middleware 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Use morgan logger for logging requests
app.use(logger('dev'));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
mongoose.connect('mongodb://localhost/mongoHeadlines', {
  useNewUrlParser: true
});
mongoose.connection.collections['articles'].drop(function(err) {
  console.log('collection dropped')
})
app.get("/", function(req, res) {
  res.render('index')
})
// A GET route for scraping the echoJS website
app.get('/scrape', function(req, res) {
  axios.get('https://www.foxnews.com/').then(function(response) {
    const $ = cheerio.load(response.data);
    const result = {};
    $('h2').each(function(i, element) {
      result.title = $(this)
        .children('a')
        .text();
      result.link = $(this)
        .children('a')
        .attr('href');
      db.Article.create(result)
        .then(function(dbArticle) {
          console.log(dbArticle);
        })
        .catch(function(err) {
          console.log(err);
        });
    });

    // Send a message to the client
    res.send('Scrape Complete');
  });
});

// Route for getting all Articles from the db
app.get('/articles', function(req, res) {
  db.Article.find({})
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get('/articles/:id', function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate('note')
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post('/articles/:id', function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log(`App running on port ${PORT}!`);
});
