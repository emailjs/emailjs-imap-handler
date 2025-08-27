'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function (buffers) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parser = new ParserInstance(buffers, options);
  var response = {};

  response.tag = parser.getTag();
  parser.getSpace();
  response.command = parser.getCommand();

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace();
    response.command += ' ' + parser.getElement(_formalSyntax.IS_COMMAND);
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace();
    response.attributes = parser.getAttributes();
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    });
  }

  return response;
};

var _formalSyntax = require('./formal-syntax');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function fromCharCode(uint8Array) {
  var batchSize = 10240;
  var strings = [];

  for (var i = 0; i < uint8Array.length; i += batchSize) {
    var begin = i;
    var end = Math.min(i + batchSize, uint8Array.length);
    strings.push(String.fromCharCode.apply(null, uint8Array.subarray(begin, end)));
  }

  return strings.join('');
}

function fromCharCodeTrimmed(uint8Array) {
  var begin = 0;
  var end = uint8Array.length;

  while (uint8Array[begin] === _formalSyntax.ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === _formalSyntax.ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== _formalSyntax.ASCII_SPACE) {
      return false;
    }
  }

  return true;
}

var ParserInstance = function () {
  function ParserInstance(input, options) {
    _classCallCheck(this, ParserInstance);

    this.remainder = new Uint8Array(input || 0);
    this.options = options || {};
    this.pos = 0;
  }

  _createClass(ParserInstance, [{
    key: 'getTag',
    value: function getTag() {
      if (!this.tag) {
        var syntaxChecker = function syntaxChecker(chr) {
          return (0, _formalSyntax.IS_TAG)(chr) || chr === _formalSyntax.ASCII_ASTERISK || chr === _formalSyntax.ASCII_PLUS;
        };
        this.tag = this.getElement(syntaxChecker);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement(_formalSyntax.IS_COMMAND);
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          if (this.remainder[1] === _formalSyntax.ASCII_LEFT_BRACKET) {
            var rightBracket = this.remainder.indexOf(_formalSyntax.ASCII_RIGHT_BRACKET);
            if (rightBracket > 1) {
              this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(rightBracket + 1));
              this.remainder = this.remainder.subarray(0, rightBracket + 1);
            } else {
              throw new Error('Unexpected end of input at position ' + (this.pos + this.remainder.length));
            }
          } else {
            this.humanReadable = fromCharCodeTrimmed(this.remainder);
            this.remainder = new Uint8Array(0);
          }
          break;
      }

      return this.command;
    }
  }, {
    key: 'getElement',
    value: function getElement(syntaxChecker) {
      var element = void 0;
      if (this.remainder[0] === _formalSyntax.ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(_formalSyntax.ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = this.remainder;
        } else {
          element = this.remainder.subarray(0, firstSpace);
        }

        for (var i = 0; i < element.length; i++) {
          if (!syntaxChecker(element[i])) {
            throw new Error('Unexpected char at position ' + (this.pos + i));
          }
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return fromCharCode(element);
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] !== _formalSyntax.ASCII_SPACE) {
        throw new Error('Unexpected char at position ' + this.pos);
      }

      this.pos++;
      this.remainder = this.remainder.subarray(1);
    }
  }, {
    key: 'getAttributes',
    value: function getAttributes() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] === _formalSyntax.ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes();
    }
  }]);

  return ParserInstance;
}();

var Node = function () {
  function Node(uint8Array, parentNode, startPos) {
    _classCallCheck(this, Node);

    this.uint8Array = uint8Array;
    this.childNodes = [];
    this.type = false;
    this.closed = true;
    this.valueSkip = [];
    this.startPos = startPos;
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0;

    if (parentNode) {
      this.parentNode = parentNode;
      parentNode.childNodes.push(this);
    }
  }

  _createClass(Node, [{
    key: 'getValue',
    value: function getValue() {
      var value = fromCharCode(this.getValueArray());
      return this.valueToUpperCase ? value.toUpperCase() : value;
    }
  }, {
    key: 'getValueLength',
    value: function getValueLength() {
      return this.valueEnd - this.valueStart - this.valueSkip.length;
    }
  }, {
    key: 'getValueArray',
    value: function getValueArray() {
      var valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd);

      if (this.valueSkip.length === 0) {
        return valueArray;
      }

      var filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length);
      var begin = 0;
      var offset = 0;
      var skip = this.valueSkip.slice();

      skip.push(valueArray.length);

      skip.forEach(function (end) {
        if (end > begin) {
          var subArray = valueArray.subarray(begin, end);
          filteredArray.set(subArray, offset);
          offset += subArray.length;
        }
        begin = end + 1;
      });

      return filteredArray;
    }
  }, {
    key: 'equals',
    value: function equals(value, caseSensitive) {
      if (this.getValueLength() !== value.length) {
        return false;
      }

      return this.equalsAt(value, 0, caseSensitive);
    }
  }, {
    key: 'equalsAt',
    value: function equalsAt(value, index, caseSensitive) {
      caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true;

      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;
      }

      for (var i = 0; i < value.length; i++) {
        while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
          index++;
        }

        if (index >= this.valueEnd) {
          return false;
        }

        var uint8Char = String.fromCharCode(this.uint8Array[index]);
        var char = value[i];

        if (!caseSensitive) {
          uint8Char = uint8Char.toUpperCase();
          char = char.toUpperCase();
        }

        if (uint8Char !== char) {
          return false;
        }

        index++;
      }

      return true;
    }
  }, {
    key: 'isNumber',
    value: function isNumber() {
      for (var i = 0; i < this.valueEnd - this.valueStart; i++) {
        if (this.valueSkip.indexOf(i) >= 0) {
          continue;
        }

        if (!this.isDigit(i)) {
          return false;
        }
      }

      return true;
    }
  }, {
    key: 'isDigit',
    value: function isDigit(index) {
      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index++;
        }
      }

      return (0, _formalSyntax.IS_DIGIT)(this.uint8Array[index]);
    }
  }, {
    key: 'containsChar',
    value: function containsChar(char) {
      var ascii = char.charCodeAt(0);

      for (var i = this.valueStart; i < this.valueEnd; i++) {
        if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
          continue;
        }

        if (this.uint8Array[i] === ascii) {
          return true;
        }
      }

      return false;
    }
  }]);

  return Node;
}();

var TokenParser = function () {
  function TokenParser(parent, startPos, uint8Array) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, TokenParser);

    this.uint8Array = uint8Array;
    this.options = options;
    this.parent = parent;

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = 'TREE';

    this.state = 'NORMAL';

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true;
    }

    this.processString();
  }

  _createClass(TokenParser, [{
    key: 'getAttributes',
    value: function getAttributes() {
      var _this = this;

      var attributes = [];
      var branch = attributes;

      var walk = function walk(node) {
        var elm = void 0;
        var curBranch = branch;
        var partial = void 0;

        if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
          node.closed = true;
          node.type = 'ATOM';
        }

        // If the node was never closed, throw it
        if (!node.closed) {
          throw new Error('Unexpected end of input at position ' + (_this.pos + _this.uint8Array.length - 1));
        }

        switch (node.type.toUpperCase()) {
          case 'LITERAL':
          case 'STRING':
            elm = {
              type: node.type.toUpperCase(),
              value: _this.options.valueAsString ? node.getValue() : node.getValueArray()
            };
            branch.push(elm);
            break;
          case 'SEQUENCE':
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'ATOM':
            if (node.equals('NIL', true)) {
              branch.push(null);
              break;
            }
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'SECTION':
            branch = branch[branch.length - 1].section = [];
            break;
          case 'LIST':
            elm = [];
            branch.push(elm);
            branch = elm;
            break;
          case 'PARTIAL':
            partial = node.getValue().split('.').map(Number);
            branch[branch.length - 1].partial = partial;
            break;
        }

        node.childNodes.forEach(function (childNode) {
          walk(childNode);
        });
        branch = curBranch;
      };

      walk(this.tree);

      return attributes;
    }
  }, {
    key: 'createNode',
    value: function createNode(parentNode, startPos) {
      return new Node(this.uint8Array, parentNode, startPos);
    }
  }, {
    key: 'processString',
    value: function processString() {
      var _this2 = this;

      var i = void 0;
      var len = void 0;
      var checkSP = function checkSP(pos) {
        // jump to the next non whitespace pos
        while (_this2.uint8Array[i + 1] === _formalSyntax.ASCII_SPACE) {
          i++;
        }
      };

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = this.uint8Array[i];

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case _formalSyntax.ASCII_DQUOTE:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case _formalSyntax.ASCII_LEFT_PARENTHESIS:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case _formalSyntax.ASCII_RIGHT_PARENTHESIS:
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case _formalSyntax.ASCII_RIGHT_BRACKET:
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case _formalSyntax.ASCII_LESS_THAN_SIGN:
                if (this.uint8Array[i - 1] !== _formalSyntax.ASCII_RIGHT_BRACKET) {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';
                  this.currentNode.valueStart = i;
                  this.currentNode.valueEnd = i + 1;
                  this.state = 'ATOM';
                } else {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'PARTIAL';
                  this.state = 'PARTIAL';
                  this.currentNode.closed = false;
                }
                break;

              // { starts a new literal
              case _formalSyntax.ASCII_LEFT_CURLY_BRACKET:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case _formalSyntax.ASCII_ASTERISK:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case _formalSyntax.ASCII_SPACE:
                // just ignore
                break;

              // start of a literal8, handle in case ASCII_LEFT_CURLY_BRACKET
              case _formalSyntax.ASCII_TILDE:
                break;

              // [ starts section
              case _formalSyntax.ASCII_LEFT_BRACKET:
                // If it is the *first* element after response command, then process as a response argument list
                if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                  this.currentNode.endPos = this.pos + i;

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'SECTION';
                  this.currentNode.closed = false;
                  this.state = 'NORMAL';

                  // RFC2221 defines a response code REFERRAL whose payload is an
                  // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                  // fail quite badly at parsing.  Since the imapurl is such a unique
                  // (and crazy) term, we just specialize that case here.
                  if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                    // create the REFERRAL atom
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                    this.currentNode.type = 'ATOM';
                    this.currentNode.endPos = this.pos + i + 8;
                    this.currentNode.valueStart = i + 1;
                    this.currentNode.valueEnd = i + 9;
                    this.currentNode.valueToUpperCase = true;
                    this.currentNode = this.currentNode.parentNode;

                    // eat all the way through the ] to be the  IMAPURL token.
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                    // just call this an ATOM, even though IMAPURL might be more correct
                    this.currentNode.type = 'ATOM';
                    // jump i to the ']'
                    i = this.uint8Array.indexOf(_formalSyntax.ASCII_RIGHT_BRACKET, i + 10);
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode.valueStart = this.currentNode.startPos - this.pos;
                    this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1;
                    this.currentNode = this.currentNode.parentNode;

                    // close out the SECTION
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    checkSP();
                  }

                  break;
                }
              /* falls through */
              default:
                // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                // Allow \ as the first char for atom to support system flags
                // Allow % to support LIST '' %
                if (!(0, _formalSyntax.IS_ATOM_CHAR)(chr) && chr !== _formalSyntax.ASCII_BACKSLASH && chr !== _formalSyntax.ASCII_PERCENT_SIGN) {
                  throw new Error('Unexpected char at position ' + (this.pos + i));
                }

                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'ATOM';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.state = 'ATOM';
                break;
            }
            break;

          case 'ATOM':

            // space finishes an atom
            if (chr === _formalSyntax.ASCII_SPACE) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === _formalSyntax.ASCII_RIGHT_PARENTHESIS && this.currentNode.parentNode.type === 'LIST' || chr === _formalSyntax.ASCII_RIGHT_BRACKET && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === _formalSyntax.ASCII_COMMA || chr === _formalSyntax.ASCII_COLON) && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === _formalSyntax.ASCII_LEFT_BRACKET && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === _formalSyntax.ASCII_LESS_THAN_SIGN) {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible, throw. Allow \* as an exception
            if (!(0, _formalSyntax.IS_ATOM_CHAR)(chr) && chr !== _formalSyntax.ASCII_RIGHT_BRACKET && !(chr === _formalSyntax.ASCII_ASTERISK && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === _formalSyntax.ASCII_DQUOTE) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === _formalSyntax.ASCII_BACKSLASH) {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = this.uint8Array[i];
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === _formalSyntax.ASCII_GREATER_THAN_SIGN) {
              if (this.currentNode.equalsAt('.', -1)) {
                throw new Error('Unexpected end of partial at position ' + this.pos);
              }
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              checkSP();
              break;
            }

            if (chr === _formalSyntax.ASCII_FULL_STOP && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if (!(0, _formalSyntax.IS_DIGIT)(chr) && chr !== _formalSyntax.ASCII_FULL_STOP) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== _formalSyntax.ASCII_FULL_STOP && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
              this.currentNode.valueEnd = i + 1;

              if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }

            if (chr === _formalSyntax.ASCII_PLUS) {
              // assuming capability LITERAL+ or LITERAL-
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === _formalSyntax.ASCII_RIGHT_CURLY_BRACKET) {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === _formalSyntax.ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === _formalSyntax.ASCII_CR && this.uint8Array[i + 2] === _formalSyntax.ASCII_NL) {
                i += 2;
              } else {
                throw new Error('Unexpected char at position ' + (this.pos + i));
              }
              this.currentNode.valueStart = i + 1;
              this.currentNode.literalLength = Number(this.currentNode.literalLength);
              this.currentNode.started = true;

              if (!this.currentNode.literalLength) {
                // special case where literal content length is 0
                // close the node right away, do not wait for additional input
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }
            if (!(0, _formalSyntax.IS_DIGIT)(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + String.fromCharCode(chr);
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === _formalSyntax.ASCII_SPACE) {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            } else if (this.currentNode.parentNode && chr === _formalSyntax.ASCII_RIGHT_BRACKET && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === _formalSyntax.ASCII_COLON) {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === _formalSyntax.ASCII_ASTERISK) {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === _formalSyntax.ASCII_COMMA) {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!(0, _formalSyntax.IS_DIGIT)(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if ((0, _formalSyntax.IS_DIGIT)(chr) && this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected number at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;
        }
      }
    }
  }]);

  return TokenParser;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJJU19DT01NQU5EIiwiaXNFbXB0eSIsInJlbWFpbmRlciIsImF0dHJpYnV0ZXMiLCJnZXRBdHRyaWJ1dGVzIiwiaHVtYW5SZWFkYWJsZSIsImNvbmNhdCIsInR5cGUiLCJ2YWx1ZSIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJBU0NJSV9TUEFDRSIsImlucHV0IiwiVWludDhBcnJheSIsInBvcyIsInN5bnRheENoZWNrZXIiLCJjaHIiLCJBU0NJSV9BU1RFUklTSyIsIkFTQ0lJX1BMVVMiLCJ0b1N0cmluZyIsIkFTQ0lJX0xFRlRfQlJBQ0tFVCIsInJpZ2h0QnJhY2tldCIsIkFTQ0lJX1JJR0hUX0JSQUNLRVQiLCJFcnJvciIsImVsZW1lbnQiLCJmaXJzdFNwYWNlIiwiVG9rZW5QYXJzZXIiLCJOb2RlIiwicGFyZW50Tm9kZSIsInN0YXJ0UG9zIiwiY2hpbGROb2RlcyIsImNsb3NlZCIsInZhbHVlU2tpcCIsInZhbHVlU3RhcnQiLCJ2YWx1ZUVuZCIsImdldFZhbHVlQXJyYXkiLCJ2YWx1ZVRvVXBwZXJDYXNlIiwidmFsdWVBcnJheSIsImZpbHRlcmVkQXJyYXkiLCJvZmZzZXQiLCJza2lwIiwic2xpY2UiLCJmb3JFYWNoIiwic3ViQXJyYXkiLCJzZXQiLCJjYXNlU2Vuc2l0aXZlIiwiZ2V0VmFsdWVMZW5ndGgiLCJlcXVhbHNBdCIsImluZGV4IiwidWludDhDaGFyIiwiY2hhciIsImlzRGlnaXQiLCJhc2NpaSIsImNoYXJDb2RlQXQiLCJwYXJlbnQiLCJ0cmVlIiwiY3VycmVudE5vZGUiLCJjcmVhdGVOb2RlIiwic3RhdGUiLCJ2YWx1ZUFzU3RyaW5nIiwidW5kZWZpbmVkIiwicHJvY2Vzc1N0cmluZyIsImJyYW5jaCIsIndhbGsiLCJlbG0iLCJjdXJCcmFuY2giLCJwYXJ0aWFsIiwibm9kZSIsImVxdWFscyIsImdldFZhbHVlIiwic2VjdGlvbiIsInNwbGl0IiwibWFwIiwiTnVtYmVyIiwiY2hpbGROb2RlIiwibGVuIiwiY2hlY2tTUCIsIkFTQ0lJX0RRVU9URSIsIkFTQ0lJX0xFRlRfUEFSRU5USEVTSVMiLCJBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyIsImVuZFBvcyIsIkFTQ0lJX0xFU1NfVEhBTl9TSUdOIiwiQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUIiwiQVNDSUlfVElMREUiLCJBU0NJSV9CQUNLU0xBU0giLCJBU0NJSV9QRVJDRU5UX1NJR04iLCJBU0NJSV9DT01NQSIsIkFTQ0lJX0NPTE9OIiwiaXNOdW1iZXIiLCJBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTiIsIkFTQ0lJX0ZVTExfU1RPUCIsImNvbnRhaW5zQ2hhciIsInN0YXJ0ZWQiLCJsaXRlcmFsTGVuZ3RoIiwibGl0ZXJhbFBsdXMiLCJBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VUIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7a0JBMHlCZSxVQUFVQSxPQUFWLEVBQWlDO0FBQUEsTUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUM5QyxNQUFJQyxTQUFTLElBQUlDLGNBQUosQ0FBbUJILE9BQW5CLEVBQTRCQyxPQUE1QixDQUFiO0FBQ0EsTUFBSUcsV0FBVyxFQUFmOztBQUVBQSxXQUFTQyxHQUFULEdBQWVILE9BQU9JLE1BQVAsRUFBZjtBQUNBSixTQUFPSyxRQUFQO0FBQ0FILFdBQVNJLE9BQVQsR0FBbUJOLE9BQU9P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QUNEO0FBQ0Qsa0JBQUksS0FBS3lELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl4QixLQUFKLENBQVUsa0RBQWtELEtBQUtULEdBQUwsR0FBV2YsQ0FBN0QsQ0FBVixDQUFOO0FBQ0Q7QUFDRixhQVBNLE1BT0EsSUFBSSxDQUFDLDRCQUFTaUIsR0FBVCxDQUFMLEVBQW9CO0FBQ3pCLG9CQUFNLElBQUlPLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS1QsR0FBTCxHQUFXZixDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSSw0QkFBU2lCLEdBQVQsS0FBaUIsS0FBS3dDLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBckIsRUFBeUQ7QUFDdkQsb0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxvQ0FBb0MsS0FBS1QsR0FBTCxHQUFXZixDQUEvQyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBS3lELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qm5DLElBQUksQ0FBaEM7QUFDQTtBQTdYSjtBQStYRDtBQUNGIiwiZmlsZSI6InBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEFTQ0lJX0FTVEVSSVNLLFxuICBBU0NJSV9CQUNLU0xBU0gsXG4gIEFTQ0lJX0NPTE9OLFxuICBBU0NJSV9DT01NQSxcbiAgQVNDSUlfQ1IsXG4gIEFTQ0lJX0RRVU9URSxcbiAgQVNDSUlfRlVMTF9TVE9QLFxuICBBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTixcbiAgQVNDSUlfTEVGVF9CUkFDS0VULFxuICBBU0NJSV9MRUZUX0NVUkxZX0JSQUNLRVQsXG4gIEFTQ0lJX0xFRlRfUEFSRU5USEVTSVMsXG4gIEFTQ0lJX0xFU1NfVEhBTl9TSUdOLFxuICBBU0NJSV9OTCxcbiAgQVNDSUlfUEVSQ0VOVF9TSUdOLFxuICBBU0NJSV9QTFVTLFxuICBBU0NJSV9SSUdIVF9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyxcbiAgQVNDSUlfU1BBQ0UsXG4gIEFTQ0lJX1RJTERFLFxuICBJU19DT01NQU5ELFxuICBJU19ESUdJVCxcbiAgSVNfQVRPTV9DSEFSLFxuICBJU19UQUdcbn0gZnJvbSAnLi9mb3JtYWwtc3ludGF4J1xuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGUgKHVpbnQ4QXJyYXkpIHtcbiAgY29uc3QgYmF0Y2hTaXplID0gMTAyNDBcbiAgdmFyIHN0cmluZ3MgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgY29uc3QgYmVnaW4gPSBpXG4gICAgY29uc3QgZW5kID0gTWF0aC5taW4oaSArIGJhdGNoU2l6ZSwgdWludDhBcnJheS5sZW5ndGgpXG4gICAgc3RyaW5ncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKSkpXG4gIH1cblxuICByZXR1cm4gc3RyaW5ncy5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGVUcmltbWVkICh1aW50OEFycmF5KSB7XG4gIGxldCBiZWdpbiA9IDBcbiAgbGV0IGVuZCA9IHVpbnQ4QXJyYXkubGVuZ3RoXG5cbiAgd2hpbGUgKHVpbnQ4QXJyYXlbYmVnaW5dID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGJlZ2luKytcbiAgfVxuXG4gIHdoaWxlICh1aW50OEFycmF5W2VuZCAtIDFdID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGVuZC0tXG4gIH1cblxuICBpZiAoYmVnaW4gIT09IDAgfHwgZW5kICE9PSB1aW50OEFycmF5Lmxlbmd0aCkge1xuICAgIHVpbnQ4QXJyYXkgPSB1aW50OEFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gIH1cblxuICByZXR1cm4gZnJvbUNoYXJDb2RlKHVpbnQ4QXJyYXkpXG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkgKHVpbnQ4QXJyYXkpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHVpbnQ4QXJyYXlbaV0gIT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZVxufVxuXG5jbGFzcyBQYXJzZXJJbnN0YW5jZSB7XG4gIGNvbnN0cnVjdG9yIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoaW5wdXQgfHwgMClcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdGhpcy5wb3MgPSAwXG4gIH1cbiAgZ2V0VGFnICgpIHtcbiAgICBpZiAoIXRoaXMudGFnKSB7XG4gICAgICBjb25zdCBzeW50YXhDaGVja2VyID0gKGNocikgPT4gSVNfVEFHKGNocikgfHwgY2hyID09PSBBU0NJSV9BU1RFUklTSyB8fCBjaHIgPT09IEFTQ0lJX1BMVVNcbiAgICAgIHRoaXMudGFnID0gdGhpcy5nZXRFbGVtZW50KHN5bnRheENoZWNrZXIpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRhZ1xuICB9XG5cbiAgZ2V0Q29tbWFuZCAoKSB7XG4gICAgaWYgKCF0aGlzLmNvbW1hbmQpIHtcbiAgICAgIHRoaXMuY29tbWFuZCA9IHRoaXMuZ2V0RWxlbWVudChJU19DT01NQU5EKVxuICAgIH1cblxuICAgIHN3aXRjaCAoKHRoaXMuY29tbWFuZCB8fCAnJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdPSyc6XG4gICAgICBjYXNlICdOTyc6XG4gICAgICBjYXNlICdCQUQnOlxuICAgICAgY2FzZSAnUFJFQVVUSCc6XG4gICAgICBjYXNlICdCWUUnOlxuICAgICAgICBpZiAodGhpcy5yZW1haW5kZXJbMV0gPT09IEFTQ0lJX0xFRlRfQlJBQ0tFVCkge1xuICAgICAgICAgIGxldCByaWdodEJyYWNrZXQgPSB0aGlzLnJlbWFpbmRlci5pbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQpXG4gICAgICAgICAgaWYgKHJpZ2h0QnJhY2tldCA+IDEpIHtcbiAgICAgICAgICAgIHRoaXMuaHVtYW5SZWFkYWJsZSA9IGZyb21DaGFyQ29kZVRyaW1tZWQodGhpcy5yZW1haW5kZXIuc3ViYXJyYXkocmlnaHRCcmFja2V0ICsgMSkpXG4gICAgICAgICAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDAsIHJpZ2h0QnJhY2tldCArIDEpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIHRoaXMucmVtYWluZGVyLmxlbmd0aCkpXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaHVtYW5SZWFkYWJsZSA9IGZyb21DaGFyQ29kZVRyaW1tZWQodGhpcy5yZW1haW5kZXIpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSBuZXcgVWludDhBcnJheSgwKVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29tbWFuZFxuICB9XG5cbiAgZ2V0RWxlbWVudCAoc3ludGF4Q2hlY2tlcikge1xuICAgIGxldCBlbGVtZW50XG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGxldCBmaXJzdFNwYWNlID0gdGhpcy5yZW1haW5kZXIuaW5kZXhPZihBU0NJSV9TUEFDRSlcbiAgICBpZiAodGhpcy5yZW1haW5kZXIubGVuZ3RoID4gMCAmJiBmaXJzdFNwYWNlICE9PSAwKSB7XG4gICAgICBpZiAoZmlyc3RTcGFjZSA9PT0gLTEpIHtcbiAgICAgICAgZWxlbWVudCA9IHRoaXMucmVtYWluZGVyXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50ID0gdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoMCwgZmlyc3RTcGFjZSlcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghc3ludGF4Q2hlY2tlcihlbGVtZW50W2ldKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBlbGVtZW50Lmxlbmd0aFxuICAgIHRoaXMucmVtYWluZGVyID0gdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoZWxlbWVudC5sZW5ndGgpXG5cbiAgICByZXR1cm4gZnJvbUNoYXJDb2RlKGVsZW1lbnQpXG4gIH1cblxuICBnZXRTcGFjZSAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSAhPT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcysrXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgxKVxuICB9XG5cbiAgZ2V0QXR0cmlidXRlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRva2VuUGFyc2VyKHRoaXMsIHRoaXMucG9zLCB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgpLCB0aGlzLm9wdGlvbnMpLmdldEF0dHJpYnV0ZXMoKVxuICB9XG59XG5cbmNsYXNzIE5vZGUge1xuICBjb25zdHJ1Y3RvciAodWludDhBcnJheSwgcGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5jaGlsZE5vZGVzID0gW11cbiAgICB0aGlzLnR5cGUgPSBmYWxzZVxuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZVxuICAgIHRoaXMudmFsdWVTa2lwID0gW11cbiAgICB0aGlzLnN0YXJ0UG9zID0gc3RhcnRQb3NcbiAgICB0aGlzLnZhbHVlU3RhcnQgPSB0aGlzLnZhbHVlRW5kID0gdHlwZW9mIHN0YXJ0UG9zID09PSAnbnVtYmVyJyA/IHN0YXJ0UG9zICsgMSA6IDBcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLnBhcmVudE5vZGUgPSBwYXJlbnROb2RlXG4gICAgICBwYXJlbnROb2RlLmNoaWxkTm9kZXMucHVzaCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIGdldFZhbHVlICgpIHtcbiAgICBsZXQgdmFsdWUgPSBmcm9tQ2hhckNvZGUodGhpcy5nZXRWYWx1ZUFycmF5KCkpXG4gICAgcmV0dXJuIHRoaXMudmFsdWVUb1VwcGVyQ2FzZSA/IHZhbHVlLnRvVXBwZXJDYXNlKCkgOiB2YWx1ZVxuICB9XG5cbiAgZ2V0VmFsdWVMZW5ndGggKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0IC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoXG4gIH1cblxuICBnZXRWYWx1ZUFycmF5ICgpIHtcbiAgICBjb25zdCB2YWx1ZUFycmF5ID0gdGhpcy51aW50OEFycmF5LnN1YmFycmF5KHRoaXMudmFsdWVTdGFydCwgdGhpcy52YWx1ZUVuZClcblxuICAgIGlmICh0aGlzLnZhbHVlU2tpcC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB2YWx1ZUFycmF5XG4gICAgfVxuXG4gICAgbGV0IGZpbHRlcmVkQXJyYXkgPSBuZXcgVWludDhBcnJheSh2YWx1ZUFycmF5Lmxlbmd0aCAtIHRoaXMudmFsdWVTa2lwLmxlbmd0aClcbiAgICBsZXQgYmVnaW4gPSAwXG4gICAgbGV0IG9mZnNldCA9IDBcbiAgICBsZXQgc2tpcCA9IHRoaXMudmFsdWVTa2lwLnNsaWNlKClcblxuICAgIHNraXAucHVzaCh2YWx1ZUFycmF5Lmxlbmd0aClcblxuICAgIHNraXAuZm9yRWFjaChmdW5jdGlvbiAoZW5kKSB7XG4gICAgICBpZiAoZW5kID4gYmVnaW4pIHtcbiAgICAgICAgdmFyIHN1YkFycmF5ID0gdmFsdWVBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICAgICAgICBmaWx0ZXJlZEFycmF5LnNldChzdWJBcnJheSwgb2Zmc2V0KVxuICAgICAgICBvZmZzZXQgKz0gc3ViQXJyYXkubGVuZ3RoXG4gICAgICB9XG4gICAgICBiZWdpbiA9IGVuZCArIDFcbiAgICB9KVxuXG4gICAgcmV0dXJuIGZpbHRlcmVkQXJyYXlcbiAgfVxuXG4gIGVxdWFscyAodmFsdWUsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICBpZiAodGhpcy5nZXRWYWx1ZUxlbmd0aCgpICE9PSB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVxdWFsc0F0KHZhbHVlLCAwLCBjYXNlU2Vuc2l0aXZlKVxuICB9XG5cbiAgZXF1YWxzQXQgKHZhbHVlLCBpbmRleCwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGNhc2VTZW5zaXRpdmUgPSB0eXBlb2YgY2FzZVNlbnNpdGl2ZSA9PT0gJ2Jvb2xlYW4nID8gY2FzZVNlbnNpdGl2ZSA6IHRydWVcblxuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGluZGV4IC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cblxuICAgICAgaWYgKGluZGV4ID49IHRoaXMudmFsdWVFbmQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGxldCB1aW50OENoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gICAgICBsZXQgY2hhciA9IHZhbHVlW2ldXG5cbiAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICB1aW50OENoYXIgPSB1aW50OENoYXIudG9VcHBlckNhc2UoKVxuICAgICAgICBjaGFyID0gY2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICB9XG5cbiAgICAgIGlmICh1aW50OENoYXIgIT09IGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGluZGV4KytcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaXNOdW1iZXIgKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52YWx1ZUVuZCAtIHRoaXMudmFsdWVTdGFydDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5pc0RpZ2l0KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc0RpZ2l0IChpbmRleCkge1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIElTX0RJR0lUKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gIH1cblxuICBjb250YWluc0NoYXIgKGNoYXIpIHtcbiAgICBsZXQgYXNjaWkgPSBjaGFyLmNoYXJDb2RlQXQoMClcblxuICAgIGZvciAobGV0IGkgPSB0aGlzLnZhbHVlU3RhcnQ7IGkgPCB0aGlzLnZhbHVlRW5kOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkgLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpXSA9PT0gYXNjaWkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5jbGFzcyBUb2tlblBhcnNlciB7XG4gIGNvbnN0cnVjdG9yIChwYXJlbnQsIHN0YXJ0UG9zLCB1aW50OEFycmF5LCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9uc1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50XG5cbiAgICB0aGlzLnRyZWUgPSB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKClcbiAgICB0aGlzLnBvcyA9IHN0YXJ0UG9zIHx8IDBcblxuICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdUUkVFJ1xuXG4gICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPSB0cnVlXG4gICAgfVxuXG4gICAgdGhpcy5wcm9jZXNzU3RyaW5nKClcbiAgfVxuXG4gIGdldEF0dHJpYnV0ZXMgKCkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0gW11cbiAgICBsZXQgYnJhbmNoID0gYXR0cmlidXRlc1xuXG4gICAgbGV0IHdhbGsgPSBub2RlID0+IHtcbiAgICAgIGxldCBlbG1cbiAgICAgIGxldCBjdXJCcmFuY2ggPSBicmFuY2hcbiAgICAgIGxldCBwYXJ0aWFsXG5cbiAgICAgIGlmICghbm9kZS5jbG9zZWQgJiYgbm9kZS50eXBlID09PSAnU0VRVUVOQ0UnICYmIG5vZGUuZXF1YWxzKCcqJykpIHtcbiAgICAgICAgbm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgIG5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgbm9kZSB3YXMgbmV2ZXIgY2xvc2VkLCB0aHJvdyBpdFxuICAgICAgaWYgKCFub2RlLmNsb3NlZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyB0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoIC0gMSkpXG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAobm9kZS50eXBlLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgIGNhc2UgJ1NUUklORyc6XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPyBub2RlLmdldFZhbHVlKCkgOiBub2RlLmdldFZhbHVlQXJyYXkoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQVRPTSc6XG4gICAgICAgICAgaWYgKG5vZGUuZXF1YWxzKCdOSUwnLCB0cnVlKSkge1xuICAgICAgICAgICAgYnJhbmNoLnB1c2gobnVsbClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VDVElPTic6XG4gICAgICAgICAgYnJhbmNoID0gYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5zZWN0aW9uID0gW11cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdMSVNUJzpcbiAgICAgICAgICBlbG0gPSBbXVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmFuY2ggPSBlbG1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBwYXJ0aWFsID0gbm9kZS5nZXRWYWx1ZSgpLnNwbGl0KCcuJykubWFwKE51bWJlcilcbiAgICAgICAgICBicmFuY2hbYnJhbmNoLmxlbmd0aCAtIDFdLnBhcnRpYWwgPSBwYXJ0aWFsXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cblxuICAgICAgbm9kZS5jaGlsZE5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICB3YWxrKGNoaWxkTm9kZSlcbiAgICAgIH0pXG4gICAgICBicmFuY2ggPSBjdXJCcmFuY2hcbiAgICB9XG5cbiAgICB3YWxrKHRoaXMudHJlZSlcblxuICAgIHJldHVybiBhdHRyaWJ1dGVzXG4gIH1cblxuICBjcmVhdGVOb2RlIChwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHJldHVybiBuZXcgTm9kZSh0aGlzLnVpbnQ4QXJyYXksIHBhcmVudE5vZGUsIHN0YXJ0UG9zKVxuICB9XG5cbiAgcHJvY2Vzc1N0cmluZyAoKSB7XG4gICAgbGV0IGlcbiAgICBsZXQgbGVuXG4gICAgY29uc3QgY2hlY2tTUCA9IChwb3MpID0+IHtcbiAgICAgIC8vIGp1bXAgdG8gdGhlIG5leHQgbm9uIHdoaXRlc3BhY2UgcG9zXG4gICAgICB3aGlsZSAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgICAgaSsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMCwgbGVuID0gdGhpcy51aW50OEFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBsZXQgY2hyID0gdGhpcy51aW50OEFycmF5W2ldXG5cbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlICdOT1JNQUwnOlxuXG4gICAgICAgICAgc3dpdGNoIChjaHIpIHtcbiAgICAgICAgICAgIC8vIERRVU9URSBzdGFydHMgYSBuZXcgc3RyaW5nXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0RRVU9URTpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnc3RyaW5nJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NUUklORydcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBsaXN0XG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFRlRfUEFSRU5USEVTSVM6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0xJU1QnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gKSBjbG9zZXMgYSBsaXN0XG4gICAgICAgICAgICBjYXNlIEFTQ0lJX1JJR0hUX1BBUkVOVEhFU0lTOlxuICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS50eXBlICE9PSAnTElTVCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGlzdCB0ZXJtaW5hdG9yICkgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gXSBjbG9zZXMgc2VjdGlvbiBncm91cFxuICAgICAgICAgICAgY2FzZSBBU0NJSV9SSUdIVF9CUkFDS0VUOlxuICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS50eXBlICE9PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VjdGlvbiB0ZXJtaW5hdG9yIF0gYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyA8IHN0YXJ0cyBhIG5ldyBwYXJ0aWFsXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFU1NfVEhBTl9TSUdOOlxuICAgICAgICAgICAgICBpZiAodGhpcy51aW50OEFycmF5W2kgLSAxXSAhPT0gQVNDSUlfUklHSFRfQlJBQ0tFVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnUEFSVElBTCdcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIHsgc3RhcnRzIGEgbmV3IGxpdGVyYWxcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ0xJVEVSQUwnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gKCBzdGFydHMgYSBuZXcgc2VxdWVuY2VcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfQVNURVJJU0s6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIG5vcm1hbGx5IGEgc3BhY2Ugc2hvdWxkIG5ldmVyIG9jY3VyXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX1NQQUNFOlxuICAgICAgICAgICAgICAvLyBqdXN0IGlnbm9yZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBzdGFydCBvZiBhIGxpdGVyYWw4LCBoYW5kbGUgaW4gY2FzZSBBU0NJSV9MRUZUX0NVUkxZX0JSQUNLRVRcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfVElMREU6XG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIFsgc3RhcnRzIHNlY3Rpb25cbiAgICAgICAgICAgIGNhc2UgQVNDSUlfTEVGVF9CUkFDS0VUOlxuICAgICAgICAgICAgICAvLyBJZiBpdCBpcyB0aGUgKmZpcnN0KiBlbGVtZW50IGFmdGVyIHJlc3BvbnNlIGNvbW1hbmQsIHRoZW4gcHJvY2VzcyBhcyBhIHJlc3BvbnNlIGFyZ3VtZW50IGxpc3RcbiAgICAgICAgICAgICAgaWYgKFsnT0snLCAnTk8nLCAnQkFEJywgJ0JZRScsICdQUkVBVVRIJ10uaW5kZXhPZih0aGlzLnBhcmVudC5jb21tYW5kLnRvVXBwZXJDYXNlKCkpID49IDAgJiYgdGhpcy5jdXJyZW50Tm9kZSA9PT0gdGhpcy50cmVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgICAgICAvLyBSRkMyMjIxIGRlZmluZXMgYSByZXNwb25zZSBjb2RlIFJFRkVSUkFMIHdob3NlIHBheWxvYWQgaXMgYW5cbiAgICAgICAgICAgICAgICAvLyBSRkMyMTkyL1JGQzUwOTIgaW1hcHVybCB0aGF0IHdlIHdpbGwgdHJ5IHRvIHBhcnNlIGFzIGFuIEFUT00gYnV0XG4gICAgICAgICAgICAgICAgLy8gZmFpbCBxdWl0ZSBiYWRseSBhdCBwYXJzaW5nLiAgU2luY2UgdGhlIGltYXB1cmwgaXMgc3VjaCBhIHVuaXF1ZVxuICAgICAgICAgICAgICAgIC8vIChhbmQgY3JhenkpIHRlcm0sIHdlIGp1c3Qgc3BlY2lhbGl6ZSB0aGF0IGNhc2UgaGVyZS5cbiAgICAgICAgICAgICAgICBpZiAoZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheS5zdWJhcnJheShpICsgMSwgaSArIDEwKSkudG9VcHBlckNhc2UoKSA9PT0gJ1JFRkVSUkFMICcpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgUkVGRVJSQUwgYXRvbVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCB0aGlzLnBvcyArIGkgKyAxKVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSArIDhcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGkgKyAxXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDlcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVUb1VwcGVyQ2FzZSA9IHRydWVcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICAgICAgLy8gZWF0IGFsbCB0aGUgd2F5IHRocm91Z2ggdGhlIF0gdG8gYmUgdGhlICBJTUFQVVJMIHRva2VuLlxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCB0aGlzLnBvcyArIGkgKyAxMClcbiAgICAgICAgICAgICAgICAgIC8vIGp1c3QgY2FsbCB0aGlzIGFuIEFUT00sIGV2ZW4gdGhvdWdoIElNQVBVUkwgbWlnaHQgYmUgbW9yZSBjb3JyZWN0XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICAgIC8vIGp1bXAgaSB0byB0aGUgJ10nXG4gICAgICAgICAgICAgICAgICBpID0gdGhpcy51aW50OEFycmF5LmluZGV4T2YoQVNDSUlfUklHSFRfQlJBQ0tFVCwgaSArIDEwKVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgLSAxXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSB0aGlzLmN1cnJlbnROb2RlLnN0YXJ0UG9zIC0gdGhpcy5wb3NcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyAtIHRoaXMucG9zICsgMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgICAgICAvLyBjbG9zZSBvdXQgdGhlIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgLy8gQW55IEFUT00gc3VwcG9ydGVkIGNoYXIgc3RhcnRzIGEgbmV3IEF0b20gc2VxdWVuY2UsIG90aGVyd2lzZSB0aHJvdyBhbiBlcnJvclxuICAgICAgICAgICAgICAvLyBBbGxvdyBcXCBhcyB0aGUgZmlyc3QgY2hhciBmb3IgYXRvbSB0byBzdXBwb3J0IHN5c3RlbSBmbGFnc1xuICAgICAgICAgICAgICAvLyBBbGxvdyAlIHRvIHN1cHBvcnQgTElTVCAnJyAlXG4gICAgICAgICAgICAgIGlmICghSVNfQVRPTV9DSEFSKGNocikgJiYgY2hyICE9PSBBU0NJSV9CQUNLU0xBU0ggJiYgY2hyICE9PSBBU0NJSV9QRVJDRU5UX1NJR04pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ0FUT00nXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnQVRPTSc6XG5cbiAgICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyBhbiBhdG9tXG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgIChjaHIgPT09IEFTQ0lJX1JJR0hUX1BBUkVOVEhFU0lTICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnTElTVCcpIHx8XG4gICAgICAgICAgICAgIChjaHIgPT09IEFTQ0lJX1JJR0hUX0JSQUNLRVQgJiYgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLnR5cGUgPT09ICdTRUNUSU9OJylcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgoY2hyID09PSBBU0NJSV9DT01NQSB8fCBjaHIgPT09IEFTQ0lJX0NPTE9OKSAmJiB0aGlzLmN1cnJlbnROb2RlLmlzTnVtYmVyKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBbIHN0YXJ0cyBhIHNlY3Rpb24gZ3JvdXAgZm9yIHRoaXMgZWxlbWVudFxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0xFRlRfQlJBQ0tFVCAmJiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ0JPRFknLCBmYWxzZSkgfHwgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ0JPRFkuUEVFSycsIGZhbHNlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSwgdGhpcy5wb3MgKyBpKVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFQ1RJT04nXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfTEVTU19USEFOX1NJR04pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzdGFydCBvZiBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBpZiB0aGUgY2hhciBpcyBub3QgQVRPTSBjb21wYXRpYmxlLCB0aHJvdy4gQWxsb3cgXFwqIGFzIGFuIGV4Y2VwdGlvblxuICAgICAgICAgIGlmICghSVNfQVRPTV9DSEFSKGNocikgJiYgY2hyICE9PSBBU0NJSV9SSUdIVF9CUkFDS0VUICYmICEoY2hyID09PSBBU0NJSV9BU1RFUklTSyAmJiB0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnXFxcXCcpKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ1xcXFwqJykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ1NUUklORyc6XG5cbiAgICAgICAgICAvLyBEUVVPVEUgZW5kcyB0aGUgc3RyaW5nIHNlcXVlbmNlXG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfRFFVT1RFKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFxcIEVzY2FwZXMgdGhlIGZvbGxvd2luZyBjaGFyXG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfQkFDS1NMQVNIKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU2tpcC5wdXNoKGkgLSB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQpXG4gICAgICAgICAgICBpKytcbiAgICAgICAgICAgIGlmIChpID49IGxlbikge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNociA9IHRoaXMudWludDhBcnJheVtpXVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8qIC8vIHNraXAgdGhpcyBjaGVjaywgb3RoZXJ3aXNlIHRoZSBwYXJzZXIgbWlnaHQgZXhwbG9kZSBvbiBiaW5hcnkgaW5wdXRcbiAgICAgICAgICBpZiAoVEVYVF9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAqL1xuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTikge1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJy4nLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0ZVTExfU1RPUCAmJiAoIXRoaXMuY3VycmVudE5vZGUuZ2V0VmFsdWVMZW5ndGgoKSB8fCB0aGlzLmN1cnJlbnROb2RlLmNvbnRhaW5zQ2hhcignLicpKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHBhcnRpYWwgc2VwYXJhdG9yIC4gYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghSVNfRElHSVQoY2hyKSAmJiBjaHIgIT09IEFTQ0lJX0ZVTExfU1RPUCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgIT09IEFTQ0lJX0ZVTExfU1RPUCAmJiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJzAnKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuMCcsIC0yKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ0xJVEVSQUwnOlxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpID49IHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX1BMVVMpIHtcbiAgICAgICAgICAgIC8vIGFzc3VtaW5nIGNhcGFiaWxpdHkgTElURVJBTCsgb3IgTElURVJBTC1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbFBsdXMgPSB0cnVlXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX1JJR0hUX0NVUkxZX0JSQUNLRVQpIHtcbiAgICAgICAgICAgIGlmICghKCdsaXRlcmFsTGVuZ3RoJyBpbiB0aGlzLmN1cnJlbnROb2RlKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGl0ZXJhbCBwcmVmaXggZW5kIGNoYXIgfSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfTkwpIHtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX0NSICYmIHRoaXMudWludDhBcnJheVtpICsgMl0gPT09IEFTQ0lJX05MKSB7XG4gICAgICAgICAgICAgIGkgKz0gMlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCA9IE51bWJlcih0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQgPSB0cnVlXG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoKSB7XG4gICAgICAgICAgICAgIC8vIHNwZWNpYWwgY2FzZSB3aGVyZSBsaXRlcmFsIGNvbnRlbnQgbGVuZ3RoIGlzIDBcbiAgICAgICAgICAgICAgLy8gY2xvc2UgdGhlIG5vZGUgcmlnaHQgYXdheSwgZG8gbm90IHdhaXQgZm9yIGFkZGl0aW9uYWwgaW5wdXRcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFJU19ESUdJVChjaHIpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPT09ICcwJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpdGVyYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoIHx8ICcnKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoY2hyKVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIC8vIHNwYWNlIGZpbmlzaGVzIHRoZSBzZXF1ZW5jZSBzZXRcbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJzonLCAtMikpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgICBjaHIgPT09IEFTQ0lJX1JJR0hUX0JSQUNLRVQgJiZcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0NPTE9OKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUuaXNEaWdpdCgtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHJhbmdlIHNlcGFyYXRvciA6IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gQVNDSUlfQVNURVJJU0spIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnLCcsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgcmFuZ2Ugd2lsZGNhcmQgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoY2hyID09PSBBU0NJSV9DT01NQSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZXF1ZW5jZSBzZXBhcmF0b3IgLCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIUlTX0RJR0lUKGNocikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoSVNfRElHSVQoY2hyKSAmJiB0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbnVtYmVyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoYnVmZmVycywgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCBwYXJzZXIgPSBuZXcgUGFyc2VySW5zdGFuY2UoYnVmZmVycywgb3B0aW9ucylcbiAgbGV0IHJlc3BvbnNlID0ge31cblxuICByZXNwb25zZS50YWcgPSBwYXJzZXIuZ2V0VGFnKClcbiAgcGFyc2VyLmdldFNwYWNlKClcbiAgcmVzcG9uc2UuY29tbWFuZCA9IHBhcnNlci5nZXRDb21tYW5kKClcblxuICBpZiAoWydVSUQnLCAnQVVUSEVOVElDQVRFJ10uaW5kZXhPZigocmVzcG9uc2UuY29tbWFuZCB8fCAnJykudG9VcHBlckNhc2UoKSkgPj0gMCkge1xuICAgIHBhcnNlci5nZXRTcGFjZSgpXG4gICAgcmVzcG9uc2UuY29tbWFuZCArPSAnICcgKyBwYXJzZXIuZ2V0RWxlbWVudChJU19DT01NQU5EKVxuICB9XG5cbiAgaWYgKCFpc0VtcHR5KHBhcnNlci5yZW1haW5kZXIpKSB7XG4gICAgcGFyc2VyLmdldFNwYWNlKClcbiAgICByZXNwb25zZS5hdHRyaWJ1dGVzID0gcGFyc2VyLmdldEF0dHJpYnV0ZXMoKVxuICB9XG5cbiAgaWYgKHBhcnNlci5odW1hblJlYWRhYmxlKSB7XG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IChyZXNwb25zZS5hdHRyaWJ1dGVzIHx8IFtdKS5jb25jYXQoe1xuICAgICAgdHlwZTogJ1RFWFQnLFxuICAgICAgdmFsdWU6IHBhcnNlci5odW1hblJlYWRhYmxlXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuIl19