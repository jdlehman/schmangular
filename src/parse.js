'use strict';

function parse(expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}

/*
 * Takes string expression and returns collection
 * of tokens parse from string
 * ex "a + b" tokens a, +, b
 */
function Lexer() {
}

/*
 * @text: string to break into tokens
 * this.text: the original string
 * this.index: current character index in string
 * this.ch: current character
 * this.tokens: resulting collection of tokens
 */
Lexer.prototype.lex = function(text) {
  this.text = text;
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];

  while(this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);
    if(this.isNumber(this.ch) ||
       (this.ch === '.' && this.isNumber(this.peek()))) {
      this.readNumber();
    } else {
      throw 'Unexpected next character: ' + this.ch;
    }
  }

  return this.tokens;
};

/*
 * Returns true or false if the character is a number
 * @ch: character
 */
Lexer.prototype.isNumber = function(ch) {
  return '0' <= ch && ch <= '9';
};

/*
 * Loops over the text, character by character,
 * building up the number as it goes
 * then pushes the number it built as a token
 */
Lexer.prototype.readNumber = function() {
  var number = '';
  // build up the number
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if(ch === '.' || this.isNumber(ch)) {
      number += ch;
    } else {
      break;
    }
    this.index++;
  }

  number = 1 * number;
  this.tokens.push({
    text: number,
    fn: _.constant(number),
    json: true
  });
};

/* 
 * returns the next character in the text
 * or false if there is not one
 */
Lexer.prototype.peek = function() {
  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) : 
    false;
};


/*
 * Takes collection of tokens and returns
 * a function that evaluates the expression
 * in the given context
 */
function Parser(lexer) {
  this.lexer = lexer;
}

Parser.prototype.parse = function(text) {
  this.tokens = this.lexer.lex(text);
  return this.primary();
};

/*
 * Sets constant and literal values
 * for the primary (first token)
 */
Parser.prototype.primary = function() {
  var token = this.tokens[0];
  var primary = token.fn;
  if(token.json) {
    primary.constant = true;
    primary.literal = true;
  }
  return primary;
};
