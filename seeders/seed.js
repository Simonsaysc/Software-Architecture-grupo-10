require('dotenv').config();
const { faker } = require('@faker-js/faker');
const sequelize = require('../config/db');
const Author = require('../models/authorModel');
const Book = require('../models/bookModel');
const Review = require('../models/reviewModel');
const Sales = require('../models/salesModel');

const NUM_AUTHORS = 50;
const NUM_BOOKS = 300;
const CURRENT_YEAR = new Date().getFullYear();

const GENRES = ['Fiction', 'Non-fiction', 'Fantasy', 'Sci-Fi', 'Mystery', 'Biography', 'Romance', 'Horror'];

function randomInt(min, max) {
  return faker.number.int({ min, max });
}

function bookTitle() {
  const words = faker.lorem.words({ min: 2, max: 5 }).split(' ');
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

async function seed() {
  // WARNING: force:true drops and recreates every table. Only run this
  // against your local dev database, never anything with real data.
  await sequelize.sync({ force: true });

  console.log('Seeding authors...');
  const authors = [];
  for (let i = 0; i < NUM_AUTHORS; i++) {
    const author = await Author.create({
      name: faker.person.fullName(),
      bio: faker.lorem.paragraph(),
      country: faker.location.country(),
      birthdate: faker.date.birthdate({ min: 25, max: 85, mode: 'age' }),
    });
    authors.push(author);
  }

  console.log('Seeding books, reviews and sales...');
  for (let i = 0; i < NUM_BOOKS; i++) {
    const author = faker.helpers.arrayElement(authors);
    const releaseYear = randomInt(1980, CURRENT_YEAR - 6);
    const releaseDate = faker.date.between({
      from: `${releaseYear}-01-01`,
      to: `${releaseYear}-12-31`,
    });

    const book = await Book.create({
      title: bookTitle(),
      genre: faker.helpers.arrayElement(GENRES),
      summary: faker.lorem.paragraphs(2),
      release_date: releaseDate,
      AuthorId: author.id,
      sales: 0,
    });

    const numReviews = randomInt(1, 10);
    for (let r = 0; r < numReviews; r++) {
      await Review.create({
        rating: randomInt(1, 5),
        comment: faker.lorem.sentences(2),
        reviewer_name: faker.person.fullName(),
        up_votes: randomInt(0, 500),
        BookId: book.id,
      });
    }

    const numSalesYears = randomInt(5, 8);
    let totalSales = 0;
    for (let y = 0; y < numSalesYears; y++) {
      const year = releaseYear + y;
      if (year > CURRENT_YEAR) break;
      const quantity = randomInt(100, 50000);
      totalSales += quantity;
      await Sales.create({ year, quantity, BookId: book.id });
    }

    await book.update({ sales: totalSales });

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${NUM_BOOKS} books done`);
  }

  console.log('Done seeding!');
  await sequelize.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});