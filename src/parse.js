'use strict';

var ESCAPES = {
  'n': '\n',
  'f': '\f',
  'r': '\r',
  't': '\t',
  'v': '\v',
  '\'': '\'',
  '"': '"'
};

var OPERATORS = {
  'null': _.constant(null),
  'true': _.constant(true),
  'false': _.constant(false)
};

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
 * Breaks text into tokens.
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
    } else if(this.ch ==='\'' || this.ch === '"') {
      this.readString(this.ch);
    } else if(this.ch === '[' || this.ch === ']'
             || this.ch === ',') {
      this.tokens.push({
        text: this.ch,
        json: true
      });
      this.index++;
    } else if(this.isIdent(this.ch)) { // read identifier
      this.readIdent();
    } else if(this.isWhitespace(this.ch)) {
      this.index++;
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
 * Returns true or false if character is
 * an identifier.
 * @ch: character
 */
Lexer.prototype.isIdent = function(ch) {
  return (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch<= 'Z') ||
    ch === '_' || ch === '$';
};

/*
 * Returns true or false if character is whitespace
 * @ch: character
 */
Lexer.prototype.isWhitespace = function(ch) {
  return (ch === ' ' || ch === '\r' || ch === '\t' ||
          ch === '\n' || ch === '\v' || ch === '\u00A0');
};

/*
 * Loops over the test, character by character,
 * building the string as it goes,
 * then pushes string it built as a token.
 * Handles character escapes and single and double quotes
 * @quote: optional, quote type (' or ")
 */
Lexer.prototype.readString = function(quote) {
  this.index++;
  var string = '';
  var escape = false;
  // build up string
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if(escape) { // check if in escape mode
      if(ch === 'u') {// handle unicode characters
        var hex = this.text.substring(this.index + 1, this.index + 5);
        // check that hex is valid unicode
        if(!hex.match(/[\da-f]{4}/i)) {
          throw 'Invalid unicode escape';
        }
        this.index += 4;
        string = String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if(replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }
      escape = false;
    } else if(ch === quote) { // check if string terminates
      this.index++;
      this.tokens.push({
        text: quote + string + quote,
        fn: _.constant(string),
        json: true
      });
      return;
    } else if(ch === '\\') {
      // go into escape mode
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }

  throw 'Unmatched quote';
};

/*
 * Loops over the text, character by character,
 * building up the number as it goes
 * then pushes the number it built as a token.
 * handles scientific notation and decimals
 */
Lexer.prototype.readNumber = function() {
  var number = '';
  // build up the number
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index).toLowerCase();
    if(ch === '.' || this.isNumber(ch)) {
      number += ch;
    } else {
      // handle scientific notation
      var nextCh = this.peek();
      var prevCh = number.charAt(number.length - 1);

      if(ch == 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      } else if(this.isExpOperator(ch) && prevCh === 'e' &&
                nextCh && this.isNumber(nextCh)) {
        number += ch;
      } else if(this.isExpOperator(ch) && prevCh === 'e' &&
                (!nextCh || !this.isNumber(nextCh))) {
        throw 'Invalid exponent';
      } else {
        break;
      }
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
 * Loops over the text character
 * by character to build the identifier
 */
Lexer.prototype.readIdent = function() {
  var text = '';
  while(this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if(this.isIdent(ch) || this.isNumber(ch)) {
      text += ch;
    } else {
      break;
    }
    this.index++;
  }

  var token = {text: text};
  if(OPERATORS.hasOwnProperty(text)) {
    token.fn = OPERATORS[text];
    token.json = true;
  }

  this.tokens.push(token);
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
 * Return true if the character is an
 * exponent operator, false otherwise
 */
Lexer.prototype.isExpOperator = function(ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
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
  var primary;
  if(this.expect('[')) {
    primary = this.arrayDeclaration();
  } else {
    var token = this.expect();
    primary = token.fn
    if(token.json) {
      primary.constant = true;
      primary.literal = true;
    }
  }
  return primary;
};

/*
 * consumes and returns the next token.
 * if an expected token is given, return and
 * consume the next token if it matches, otherwise
 * do nothing.
 * returns undefined if no more tokens
 * @e: expected token (optional)
 */
Parser.prototype.expect = function(e) {
  var token = this.peek(e);
  if(token) {
    return this.tokens.shift();
  }
};

/*
 * Recursively builds array from 
 * primary expressions.
 */
Parser.prototype.arrayDeclaration = function() {
  var elementFns = [];
  if(!this.peek(']')) {
    do {
      elementFns.push(this.primary());
    } while(this.expect(','));
  }
  this.consume(']');
  return function() {
    return _.map(elementFns, function(elementFn) {
      return elementFn();
    });
  };
};

/*
 * Consume the expected token. If the next token
 * does not match, throw an error.
 * This essentially does the same thing as Parser::expect
 * but throws an error when the matching token is not found.
 * @e: expected token
 */
Parser.prototype.consume = function(e) {
  if(!this.expect(e)) {
    throw 'Unexpected. Expecting' + e;
  }
};

/*
 * Peeks at next element and returns it.
 * Or returns expected token if it is the next token
 * @e: expected token (optional)
 */
Parser.prototype.peek = function(e) {
  if(this.tokens.length > 0) {
    var text = this.tokens[0].text;
    if(text === e || !e) {
      return this.tokens[0];
    }
  }
};
