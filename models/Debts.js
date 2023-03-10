const mongoose = require("mongoose")
const Schema  = mongoose.Schema;

const DebtsSchema = new Schema({
  user: {
    title: String,
    date: String,
    month: {
      title: String,
      listMonth: {
        debt: String,
        category: String,
        value: String,
        expirationDate: String        
      }
    }
  },
}, {timestamp: true})

const Debts = mongoose.model('Debts', DebtsSchema)

module.exports = Debts;
