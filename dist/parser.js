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
          var lastRightBracket = this.remainder.lastIndexOf(_formalSyntax.ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === _formalSyntax.ASCII_LEFT_BRACKET && lastRightBracket > 1) {
            this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1));
            this.remainder = this.remainder.subarray(0, lastRightBracket + 1);
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
              if (chr === 0) {
                throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
              }
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

            if (chr === _formalSyntax.ASCII_PLUS && this.options.literalPlus) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJJU19DT01NQU5EIiwiaXNFbXB0eSIsInJlbWFpbmRlciIsImF0dHJpYnV0ZXMiLCJnZXRBdHRyaWJ1dGVzIiwiaHVtYW5SZWFkYWJsZSIsImNvbmNhdCIsInR5cGUiLCJ2YWx1ZSIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJBU0NJSV9TUEFDRSIsImlucHV0IiwiVWludDhBcnJheSIsInBvcyIsInN5bnRheENoZWNrZXIiLCJjaHIiLCJBU0NJSV9BU1RFUklTSyIsIkFTQ0lJX1BMVVMiLCJ0b1N0cmluZyIsImxhc3RSaWdodEJyYWNrZXQiLCJsYXN0SW5kZXhPZiIsIkFTQ0lJX1JJR0hUX0JSQUNLRVQiLCJBU0NJSV9MRUZUX0JSQUNLRVQiLCJlbGVtZW50IiwiRXJyb3IiLCJmaXJzdFNwYWNlIiwiVG9rZW5QYXJzZXIiLCJOb2RlIiwicGFyZW50Tm9kZSIsInN0YXJ0UG9zIiwiY2hpbGROb2RlcyIsImNsb3NlZCIsInZhbHVlU2tpcCIsInZhbHVlU3RhcnQiLCJ2YWx1ZUVuZCIsImdldFZhbHVlQXJyYXkiLCJ2YWx1ZVRvVXBwZXJDYXNlIiwidmFsdWVBcnJheSIsImZpbHRlcmVkQXJyYXkiLCJvZmZzZXQiLCJza2lwIiwic2xpY2UiLCJmb3JFYWNoIiwic3ViQXJyYXkiLCJzZXQiLCJjYXNlU2Vuc2l0aXZlIiwiZ2V0VmFsdWVMZW5ndGgiLCJlcXVhbHNBdCIsImluZGV4IiwidWludDhDaGFyIiwiY2hhciIsImlzRGlnaXQiLCJhc2NpaSIsImNoYXJDb2RlQXQiLCJwYXJlbnQiLCJ0cmVlIiwiY3VycmVudE5vZGUiLCJjcmVhdGVOb2RlIiwic3RhdGUiLCJ2YWx1ZUFzU3RyaW5nIiwidW5kZWZpbmVkIiwicHJvY2Vzc1N0cmluZyIsImJyYW5jaCIsIndhbGsiLCJlbG0iLCJjdXJCcmFuY2giLCJwYXJ0aWFsIiwibm9kZSIsImVxdWFscyIsImdldFZhbHVlIiwic2VjdGlvbiIsInNwbGl0IiwibWFwIiwiTnVtYmVyIiwiY2hpbGROb2RlIiwibGVuIiwiY2hlY2tTUCIsIkFTQ0lJX0RRVU9URSIsIkFTQ0lJX0xFRlRfUEFSRU5USEVTSVMiLCJBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyIsImVuZFBvcyIsIkFTQ0lJX0xFU1NfVEhBTl9TSUdOIiwiQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUIiwiQVNDSUlfQkFDS1NMQVNIIiwiQVNDSUlfUEVSQ0VOVF9TSUdOIiwiQVNDSUlfQ09NTUEiLCJBU0NJSV9DT0xPTiIsImlzTnVtYmVyIiwiQVNDSUlfR1JFQVRFUl9USEFOX1NJR04iLCJBU0NJSV9GVUxMX1NUT1AiLCJjb250YWluc0NoYXIiLCJzdGFydGVkIiwibGl0ZXJhbExlbmd0aCIsImxpdGVyYWxQbHVzIiwiQVNDSUlfUklHSFRfQ1VSTFlfQlJBQ0tFVCIsIkFTQ0lJX05MIiwiQVNDSUlfQ1IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O2tCQW15QmUsVUFBVUEsT0FBVixFQUFpQztBQUFBLE1BQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFDOUMsTUFBSUMsU0FBUyxJQUFJQyxjQUFKLENBQW1CSCxPQUFuQixFQUE0QkMsT0FBNUIsQ0FBYjtBQUNBLE1BQUlHLFdBQVcsRUFBZjs7QUFFQUEsV0FBU0MsR0FBVCxHQUFlSCxPQUFPSSxNQUFQLEVBQWY7QUFDQUosU0FBT0ssUUFBUDtBQUNBSCxXQUFTSSxPQUFULEdBQW1CTixPQUFPTyxVQUFQLEVBQW5COztBQUVBLE1BQUksQ0FBQyxLQUFELEVBQVEsY0FBUixFQUF3QkMsT0FBeEIsQ0FBZ0MsQ0FBQ04sU0FBU0ksT0FBVCxJQUFvQixFQUFyQixFQUF5QkcsV0FBekIsRUFBaEMsS0FBMkUsQ0FBL0UsRUFBa0Y7QUFDaEZULFdBQU9LLFFBQVA7QUFDQUgsYUFBU0ksT0FBVCxJQUFvQixNQUFNTixPQUFPVSxVQUFQLENBQWtCQyx3QkFBbEIsQ0FBMUI7QUFDRDs7QUFFRCxNQUFJLENBQUNDLFFBQVFaLE9BQU9hLFNBQWYsQ0FBTCxFQUFnQztBQUM5QmIsV0FBT0ssUUFBUDtBQUNBSCxhQUFTWSxVQUFULEdBQXNCZCxPQUFPZSxhQUFQLEVBQXRCO0FBQ0Q7O0FBRUQsTUFBSWYsT0FBT2dCLGFBQVgsRUFBMEI7QUFDeEJkLGFBQVNZLFVBQVQsR0FBc0IsQ0FBQ1osU0FBU1ksVUFBVCxJQUF1QixFQUF4QixFQUE0QkcsTUFBNUIsQ0FBbUM7QUFDdkRDLFlBQU0sTUFEaUQ7QUFFdkRDLGFBQU9uQixPQUFPZ0I7QUFGeUMsS0FBbkMsQ0FBdEI7QUFJRDs7QUFFRCxTQUFPZCxRQUFQO0FBQ0QsQzs7QUE3ekJEOzs7O0FBMEJBLFNBQVNrQixZQUFULENBQXVCQyxVQUF2QixFQUFtQztBQUNqQyxNQUFNQyxZQUFZLEtBQWxCO0FBQ0EsTUFBSUMsVUFBVSxFQUFkOztBQUVBLE9BQUssSUFBSUMsSUFBSSxDQUFiLEVBQWdCQSxJQUFJSCxXQUFXSSxNQUEvQixFQUF1Q0QsS0FBS0YsU0FBNUMsRUFBdUQ7QUFDckQsUUFBTUksUUFBUUYsQ0FBZDtBQUNBLFFBQU1HLE1BQU1DLEtBQUtDLEdBQUwsQ0FBU0wsSUFBSUYsU0FBYixFQUF3QkQsV0FBV0ksTUFBbkMsQ0FBWjtBQUNBRixZQUFRTyxJQUFSLENBQWFDLE9BQU9YLFlBQVAsQ0FBb0JZLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDWCxXQUFXWSxRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBaEMsQ0FBYjtBQUNEOztBQUVELFNBQU9KLFFBQVFXLElBQVIsQ0FBYSxFQUFiLENBQVA7QUFDRDs7QUFFRCxTQUFTQyxtQkFBVCxDQUE4QmQsVUFBOUIsRUFBMEM7QUFDeEMsTUFBSUssUUFBUSxDQUFaO0FBQ0EsTUFBSUMsTUFBTU4sV0FBV0ksTUFBckI7O0FBRUEsU0FBT0osV0FBV0ssS0FBWCxNQUFzQlUseUJBQTdCLEVBQTBDO0FBQ3hDVjtBQUNEOztBQUVELFNBQU9MLFdBQVdNLE1BQU0sQ0FBakIsTUFBd0JTLHlCQUEvQixFQUE0QztBQUMxQ1Q7QUFDRDs7QUFFRCxNQUFJRCxVQUFVLENBQVYsSUFBZUMsUUFBUU4sV0FBV0ksTUFBdEMsRUFBOEM7QUFDNUNKLGlCQUFhQSxXQUFXWSxRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBYjtBQUNEOztBQUVELFNBQU9QLGFBQWFDLFVBQWIsQ0FBUDtBQUNEOztBQUVELFNBQVNULE9BQVQsQ0FBa0JTLFVBQWxCLEVBQThCO0FBQzVCLE9BQUssSUFBSUcsSUFBSSxDQUFiLEVBQWdCQSxJQUFJSCxXQUFXSSxNQUEvQixFQUF1Q0QsR0FBdkMsRUFBNEM7QUFDMUMsUUFBSUgsV0FBV0csQ0FBWCxNQUFrQlkseUJBQXRCLEVBQW1DO0FBQ2pDLGFBQU8sS0FBUDtBQUNEO0FBQ0Y7O0FBRUQsU0FBTyxJQUFQO0FBQ0Q7O0lBRUtuQyxjO0FBQ0osMEJBQWFvQyxLQUFiLEVBQW9CdEMsT0FBcEIsRUFBNkI7QUFBQTs7QUFDM0IsU0FBS2MsU0FBTCxHQUFpQixJQUFJeUIsVUFBSixDQUFlRCxTQUFTLENBQXhCLENBQWpCO0FBQ0EsU0FBS3RDLE9BQUwsR0FBZUEsV0FBVyxFQUExQjtBQUNBLFNBQUt3QyxHQUFMLEdBQVcsQ0FBWDtBQUNEOzs7OzZCQUNTO0FBQ1IsVUFBSSxDQUFDLEtBQUtwQyxHQUFWLEVBQWU7QUFDYixZQUFNcUMsZ0JBQWdCLFNBQWhCQSxhQUFnQixDQUFDQyxHQUFEO0FBQUEsaUJBQVMsMEJBQU9BLEdBQVAsS0FBZUEsUUFBUUMsNEJBQXZCLElBQXlDRCxRQUFRRSx3QkFBMUQ7QUFBQSxTQUF0QjtBQUNBLGFBQUt4QyxHQUFMLEdBQVcsS0FBS08sVUFBTCxDQUFnQjhCLGFBQWhCLENBQVg7QUFDRDtBQUNELGFBQU8sS0FBS3JDLEdBQVo7QUFDRDs7O2lDQUVhO0FBQ1osVUFBSSxDQUFDLEtBQUtHLE9BQVYsRUFBbUI7QUFDakIsYUFBS0EsT0FBTCxHQUFlLEtBQUtJLFVBQUwsQ0FBZ0JDLHdCQUFoQixDQUFmO0FBQ0Q7O0FBRUQsY0FBUSxDQUFDLEtBQUtMLE9BQUwsSUFBZ0IsRUFBakIsRUFBcUJzQyxRQUFyQixHQUFnQ25DLFdBQWhDLEVBQVI7QUFDRSxhQUFLLElBQUw7QUFDQSxhQUFLLElBQUw7QUFDQSxhQUFLLEtBQUw7QUFDQSxhQUFLLFNBQUw7QUFDQSxhQUFLLEtBQUw7QUFDRSxjQUFJb0MsbUJBQW1CLEtBQUtoQyxTQUFMLENBQWVpQyxXQUFmLENBQTJCQyxpQ0FBM0IsQ0FBdkI7QUFDQSxjQUFJLEtBQUtsQyxTQUFMLENBQWUsQ0FBZixNQUFzQm1DLGdDQUF0QixJQUE0Q0gsbUJBQW1CLENBQW5FLEVBQXNFO0FBQ3BFLGlCQUFLN0IsYUFBTCxHQUFxQm1CLG9CQUFvQixLQUFLdEIsU0FBTCxDQUFlb0IsUUFBZixDQUF3QlksbUJBQW1CLENBQTNDLENBQXBCLENBQXJCO0FBQ0EsaUJBQUtoQyxTQUFMLEdBQWlCLEtBQUtBLFNBQUwsQ0FBZW9CLFFBQWYsQ0FBd0IsQ0FBeEIsRUFBMkJZLG1CQUFtQixDQUE5QyxDQUFqQjtBQUNELFdBSEQsTUFHTztBQUNMLGlCQUFLN0IsYUFBTCxHQUFxQm1CLG9CQUFvQixLQUFLdEIsU0FBekIsQ0FBckI7QUFDQSxpQkFBS0EsU0FBTCxHQUFpQixJQUFJeUIsVUFBSixDQUFlLENBQWYsQ0FBakI7QUFDRDtBQUNEO0FBZEo7O0FBaUJBLGFBQU8sS0FBS2hDLE9BQVo7QUFDRDs7OytCQUVXa0MsYSxFQUFlO0FBQ3pCLFVBQUlTLGdCQUFKO0FBQ0EsVUFBSSxLQUFLcEMsU0FBTCxDQUFlLENBQWYsTUFBc0J1Qix5QkFBMUIsRUFBdUM7QUFDckMsY0FBTSxJQUFJYyxLQUFKLENBQVUsdUNBQXVDLEtBQUtYLEdBQXRELENBQU47QUFDRDs7QUFFRCxVQUFJWSxhQUFhLEtBQUt0QyxTQUFMLENBQWVMLE9BQWYsQ0FBdUI0Qix5QkFBdkIsQ0FBakI7QUFDQSxVQUFJLEtBQUt2QixTQUFMLENBQWVZLE1BQWYsR0FBd0IsQ0FBeEIsSUFBNkIwQixlQUFlLENBQWhELEVBQW1EO0FBQ2pELFlBQUlBLGVBQWUsQ0FBQyxDQUFwQixFQUF1QjtBQUNyQkYsb0JBQVUsS0FBS3BDLFNBQWY7QUFDRCxTQUZELE1BRU87QUFDTG9DLG9CQUFVLEtBQUtwQyxTQUFMLENBQWVvQixRQUFmLENBQXdCLENBQXhCLEVBQTJCa0IsVUFBM0IsQ0FBVjtBQUNEOztBQUVELGFBQUssSUFBSTNCLElBQUksQ0FBYixFQUFnQkEsSUFBSXlCLFFBQVF4QixNQUE1QixFQUFvQ0QsR0FBcEMsRUFBeUM7QUFDdkMsY0FBSSxDQUFDZ0IsY0FBY1MsUUFBUXpCLENBQVIsQ0FBZCxDQUFMLEVBQWdDO0FBQzlCLGtCQUFNLElBQUkwQixLQUFKLENBQVUsa0NBQWtDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRjtBQUNGLE9BWkQsTUFZTztBQUNMLGNBQU0sSUFBSTBCLEtBQUosQ0FBVSx5Q0FBeUMsS0FBS1gsR0FBeEQsQ0FBTjtBQUNEOztBQUVELFdBQUtBLEdBQUwsSUFBWVUsUUFBUXhCLE1BQXBCO0FBQ0EsV0FBS1osU0FBTCxHQUFpQixLQUFLQSxTQUFMLENBQWVvQixRQUFmLENBQXdCZ0IsUUFBUXhCLE1BQWhDLENBQWpCOztBQUVBLGFBQU9MLGFBQWE2QixPQUFiLENBQVA7QUFDRDs7OytCQUVXO0FBQ1YsVUFBSSxDQUFDLEtBQUtwQyxTQUFMLENBQWVZLE1BQXBCLEVBQTRCO0FBQzFCLGNBQU0sSUFBSXlCLEtBQUosQ0FBVSx5Q0FBeUMsS0FBS1gsR0FBeEQsQ0FBTjtBQUNEOztBQUVELFVBQUksS0FBSzFCLFNBQUwsQ0FBZSxDQUFmLE1BQXNCdUIseUJBQTFCLEVBQXVDO0FBQ3JDLGNBQU0sSUFBSWMsS0FBSixDQUFVLGlDQUFpQyxLQUFLWCxHQUFoRCxDQUFOO0FBQ0Q7O0FBRUQsV0FBS0EsR0FBTDtBQUNBLFdBQUsxQixTQUFMLEdBQWlCLEtBQUtBLFNBQUwsQ0FBZW9CLFFBQWYsQ0FBd0IsQ0FBeEIsQ0FBakI7QUFDRDs7O29DQUVnQjtBQUNmLFVBQUksQ0FBQyxLQUFLcEIsU0FBTCxDQUFlWSxNQUFwQixFQUE0QjtBQUMxQixjQUFNLElBQUl5QixLQUFKLENBQVUseUNBQXlDLEtBQUtYLEdBQXhELENBQU47QUFDRDs7QUFFRCxVQUFJLEtBQUsxQixTQUFMLENBQWUsQ0FBZixNQUFzQnVCLHlCQUExQixFQUF1QztBQUNyQyxjQUFNLElBQUljLEtBQUosQ0FBVSx1Q0FBdUMsS0FBS1gsR0FBdEQsQ0FBTjtBQUNEOztBQUVELGFBQU8sSUFBSWEsV0FBSixDQUFnQixJQUFoQixFQUFzQixLQUFLYixHQUEzQixFQUFnQyxLQUFLMUIsU0FBTCxDQUFlb0IsUUFBZixFQUFoQyxFQUEyRCxLQUFLbEMsT0FBaEUsRUFBeUVnQixhQUF6RSxFQUFQO0FBQ0Q7Ozs7OztJQUdHc0MsSTtBQUNKLGdCQUFhaEMsVUFBYixFQUF5QmlDLFVBQXpCLEVBQXFDQyxRQUFyQyxFQUErQztBQUFBOztBQUM3QyxTQUFLbEMsVUFBTCxHQUFrQkEsVUFBbEI7QUFDQSxTQUFLbUMsVUFBTCxHQUFrQixFQUFsQjtBQUNBLFNBQUt0QyxJQUFMLEdBQVksS0FBWjtBQUNBLFNBQUt1QyxNQUFMLEdBQWMsSUFBZDtBQUNBLFNBQUtDLFNBQUwsR0FBaUIsRUFBakI7QUFDQSxTQUFLSCxRQUFMLEdBQWdCQSxRQUFoQjtBQUNBLFNBQUtJLFVBQUwsR0FBa0IsS0FBS0MsUUFBTCxHQUFnQixPQUFPTCxRQUFQLEtBQW9CLFFBQXBCLEdBQStCQSxXQUFXLENBQTFDLEdBQThDLENBQWhGOztBQUVBLFFBQUlELFVBQUosRUFBZ0I7QUFDZCxXQUFLQSxVQUFMLEdBQWtCQSxVQUFsQjtBQUNBQSxpQkFBV0UsVUFBWCxDQUFzQjFCLElBQXRCLENBQTJCLElBQTNCO0FBQ0Q7QUFDRjs7OzsrQkFFVztBQUNWLFVBQUlYLFFBQVFDLGFBQWEsS0FBS3lDLGFBQUwsRUFBYixDQUFaO0FBQ0EsYUFBTyxLQUFLQyxnQkFBTCxHQUF3QjNDLE1BQU1WLFdBQU4sRUFBeEIsR0FBOENVLEtBQXJEO0FBQ0Q7OztxQ0FFaUI7QUFDaEIsYUFBTyxLQUFLeUMsUUFBTCxHQUFnQixLQUFLRCxVQUFyQixHQUFrQyxLQUFLRCxTQUFMLENBQWVqQyxNQUF4RDtBQUNEOzs7b0NBRWdCO0FBQ2YsVUFBTXNDLGFBQWEsS0FBSzFDLFVBQUwsQ0FBZ0JZLFFBQWhCLENBQXlCLEtBQUswQixVQUE5QixFQUEwQyxLQUFLQyxRQUEvQyxDQUFuQjs7QUFFQSxVQUFJLEtBQUtGLFNBQUwsQ0FBZWpDLE1BQWYsS0FBMEIsQ0FBOUIsRUFBaUM7QUFDL0IsZUFBT3NDLFVBQVA7QUFDRDs7QUFFRCxVQUFJQyxnQkFBZ0IsSUFBSTFCLFVBQUosQ0FBZXlCLFdBQVd0QyxNQUFYLEdBQW9CLEtBQUtpQyxTQUFMLENBQWVqQyxNQUFsRCxDQUFwQjtBQUNBLFVBQUlDLFFBQVEsQ0FBWjtBQUNBLFVBQUl1QyxTQUFTLENBQWI7QUFDQSxVQUFJQyxPQUFPLEtBQUtSLFNBQUwsQ0FBZVMsS0FBZixFQUFYOztBQUVBRCxXQUFLcEMsSUFBTCxDQUFVaUMsV0FBV3RDLE1BQXJCOztBQUVBeUMsV0FBS0UsT0FBTCxDQUFhLFVBQVV6QyxHQUFWLEVBQWU7QUFDMUIsWUFBSUEsTUFBTUQsS0FBVixFQUFpQjtBQUNmLGNBQUkyQyxXQUFXTixXQUFXOUIsUUFBWCxDQUFvQlAsS0FBcEIsRUFBMkJDLEdBQTNCLENBQWY7QUFDQXFDLHdCQUFjTSxHQUFkLENBQWtCRCxRQUFsQixFQUE0QkosTUFBNUI7QUFDQUEsb0JBQVVJLFNBQVM1QyxNQUFuQjtBQUNEO0FBQ0RDLGdCQUFRQyxNQUFNLENBQWQ7QUFDRCxPQVBEOztBQVNBLGFBQU9xQyxhQUFQO0FBQ0Q7OzsyQkFFTzdDLEssRUFBT29ELGEsRUFBZTtBQUM1QixVQUFJLEtBQUtDLGNBQUwsT0FBMEJyRCxNQUFNTSxNQUFwQyxFQUE0QztBQUMxQyxlQUFPLEtBQVA7QUFDRDs7QUFFRCxhQUFPLEtBQUtnRCxRQUFMLENBQWN0RCxLQUFkLEVBQXFCLENBQXJCLEVBQXdCb0QsYUFBeEIsQ0FBUDtBQUNEOzs7NkJBRVNwRCxLLEVBQU91RCxLLEVBQU9ILGEsRUFBZTtBQUNyQ0Esc0JBQWdCLE9BQU9BLGFBQVAsS0FBeUIsU0FBekIsR0FBcUNBLGFBQXJDLEdBQXFELElBQXJFOztBQUVBLFVBQUlHLFFBQVEsQ0FBWixFQUFlO0FBQ2JBLGdCQUFRLEtBQUtkLFFBQUwsR0FBZ0JjLEtBQXhCOztBQUVBLGVBQU8sS0FBS2hCLFNBQUwsQ0FBZWxELE9BQWYsQ0FBdUIsS0FBS21ELFVBQUwsR0FBa0JlLEtBQXpDLEtBQW1ELENBQTFELEVBQTZEO0FBQzNEQTtBQUNEO0FBQ0YsT0FORCxNQU1PO0FBQ0xBLGdCQUFRLEtBQUtmLFVBQUwsR0FBa0JlLEtBQTFCO0FBQ0Q7O0FBRUQsV0FBSyxJQUFJbEQsSUFBSSxDQUFiLEVBQWdCQSxJQUFJTCxNQUFNTSxNQUExQixFQUFrQ0QsR0FBbEMsRUFBdUM7QUFDckMsZUFBTyxLQUFLa0MsU0FBTCxDQUFlbEQsT0FBZixDQUF1QmtFLFFBQVEsS0FBS2YsVUFBcEMsS0FBbUQsQ0FBMUQsRUFBNkQ7QUFDM0RlO0FBQ0Q7O0FBRUQsWUFBSUEsU0FBUyxLQUFLZCxRQUFsQixFQUE0QjtBQUMxQixpQkFBTyxLQUFQO0FBQ0Q7O0FBRUQsWUFBSWUsWUFBWTVDLE9BQU9YLFlBQVAsQ0FBb0IsS0FBS0MsVUFBTCxDQUFnQnFELEtBQWhCLENBQXBCLENBQWhCO0FBQ0EsWUFBSUUsT0FBT3pELE1BQU1LLENBQU4sQ0FBWDs7QUFFQSxZQUFJLENBQUMrQyxhQUFMLEVBQW9CO0FBQ2xCSSxzQkFBWUEsVUFBVWxFLFdBQVYsRUFBWjtBQUNBbUUsaUJBQU9BLEtBQUtuRSxXQUFMLEVBQVA7QUFDRDs7QUFFRCxZQUFJa0UsY0FBY0MsSUFBbEIsRUFBd0I7QUFDdEIsaUJBQU8sS0FBUDtBQUNEOztBQUVERjtBQUNEOztBQUVELGFBQU8sSUFBUDtBQUNEOzs7K0JBRVc7QUFDVixXQUFLLElBQUlsRCxJQUFJLENBQWIsRUFBZ0JBLElBQUksS0FBS29DLFFBQUwsR0FBZ0IsS0FBS0QsVUFBekMsRUFBcURuQyxHQUFyRCxFQUEwRDtBQUN4RCxZQUFJLEtBQUtrQyxTQUFMLENBQWVsRCxPQUFmLENBQXVCZ0IsQ0FBdkIsS0FBNkIsQ0FBakMsRUFBb0M7QUFDbEM7QUFDRDs7QUFFRCxZQUFJLENBQUMsS0FBS3FELE9BQUwsQ0FBYXJELENBQWIsQ0FBTCxFQUFzQjtBQUNwQixpQkFBTyxLQUFQO0FBQ0Q7QUFDRjs7QUFFRCxhQUFPLElBQVA7QUFDRDs7OzRCQUVRa0QsSyxFQUFPO0FBQ2QsVUFBSUEsUUFBUSxDQUFaLEVBQWU7QUFDYkEsZ0JBQVEsS0FBS2QsUUFBTCxHQUFnQmMsS0FBeEI7O0FBRUEsZUFBTyxLQUFLaEIsU0FBTCxDQUFlbEQsT0FBZixDQUF1QixLQUFLbUQsVUFBTCxHQUFrQmUsS0FBekMsS0FBbUQsQ0FBMUQsRUFBNkQ7QUFDM0RBO0FBQ0Q7QUFDRixPQU5ELE1BTU87QUFDTEEsZ0JBQVEsS0FBS2YsVUFBTCxHQUFrQmUsS0FBMUI7O0FBRUEsZUFBTyxLQUFLaEIsU0FBTCxDQUFlbEQsT0FBZixDQUF1QixLQUFLbUQsVUFBTCxHQUFrQmUsS0FBekMsS0FBbUQsQ0FBMUQsRUFBNkQ7QUFDM0RBO0FBQ0Q7QUFDRjs7QUFFRCxhQUFPLDRCQUFTLEtBQUtyRCxVQUFMLENBQWdCcUQsS0FBaEIsQ0FBVCxDQUFQO0FBQ0Q7OztpQ0FFYUUsSSxFQUFNO0FBQ2xCLFVBQUlFLFFBQVFGLEtBQUtHLFVBQUwsQ0FBZ0IsQ0FBaEIsQ0FBWjs7QUFFQSxXQUFLLElBQUl2RCxJQUFJLEtBQUttQyxVQUFsQixFQUE4Qm5DLElBQUksS0FBS29DLFFBQXZDLEVBQWlEcEMsR0FBakQsRUFBc0Q7QUFDcEQsWUFBSSxLQUFLa0MsU0FBTCxDQUFlbEQsT0FBZixDQUF1QmdCLElBQUksS0FBS21DLFVBQWhDLEtBQStDLENBQW5ELEVBQXNEO0FBQ3BEO0FBQ0Q7O0FBRUQsWUFBSSxLQUFLdEMsVUFBTCxDQUFnQkcsQ0FBaEIsTUFBdUJzRCxLQUEzQixFQUFrQztBQUNoQyxpQkFBTyxJQUFQO0FBQ0Q7QUFDRjs7QUFFRCxhQUFPLEtBQVA7QUFDRDs7Ozs7O0lBR0cxQixXO0FBQ0osdUJBQWE0QixNQUFiLEVBQXFCekIsUUFBckIsRUFBK0JsQyxVQUEvQixFQUF5RDtBQUFBLFFBQWR0QixPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ3ZELFNBQUtzQixVQUFMLEdBQWtCQSxVQUFsQjtBQUNBLFNBQUt0QixPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLaUYsTUFBTCxHQUFjQSxNQUFkOztBQUVBLFNBQUtDLElBQUwsR0FBWSxLQUFLQyxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsRUFBL0I7QUFDQSxTQUFLNUMsR0FBTCxHQUFXZ0IsWUFBWSxDQUF2Qjs7QUFFQSxTQUFLMkIsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLE1BQXhCOztBQUVBLFNBQUtrRSxLQUFMLEdBQWEsUUFBYjs7QUFFQSxRQUFJLEtBQUtyRixPQUFMLENBQWFzRixhQUFiLEtBQStCQyxTQUFuQyxFQUE4QztBQUM1QyxXQUFLdkYsT0FBTCxDQUFhc0YsYUFBYixHQUE2QixJQUE3QjtBQUNEOztBQUVELFNBQUtFLGFBQUw7QUFDRDs7OztvQ0FFZ0I7QUFBQTs7QUFDZixVQUFJekUsYUFBYSxFQUFqQjtBQUNBLFVBQUkwRSxTQUFTMUUsVUFBYjs7QUFFQSxVQUFJMkUsT0FBTyxTQUFQQSxJQUFPLE9BQVE7QUFDakIsWUFBSUMsWUFBSjtBQUNBLFlBQUlDLFlBQVlILE1BQWhCO0FBQ0EsWUFBSUksZ0JBQUo7O0FBRUEsWUFBSSxDQUFDQyxLQUFLcEMsTUFBTixJQUFnQm9DLEtBQUszRSxJQUFMLEtBQWMsVUFBOUIsSUFBNEMyRSxLQUFLQyxNQUFMLENBQVksR0FBWixDQUFoRCxFQUFrRTtBQUNoRUQsZUFBS3BDLE1BQUwsR0FBYyxJQUFkO0FBQ0FvQyxlQUFLM0UsSUFBTCxHQUFZLE1BQVo7QUFDRDs7QUFFRDtBQUNBLFlBQUksQ0FBQzJFLEtBQUtwQyxNQUFWLEVBQWtCO0FBQ2hCLGdCQUFNLElBQUlQLEtBQUosQ0FBVSwwQ0FBMEMsTUFBS1gsR0FBTCxHQUFXLE1BQUtsQixVQUFMLENBQWdCSSxNQUEzQixHQUFvQyxDQUE5RSxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBUW9FLEtBQUszRSxJQUFMLENBQVVULFdBQVYsRUFBUjtBQUNFLGVBQUssU0FBTDtBQUNBLGVBQUssUUFBTDtBQUNFaUYsa0JBQU07QUFDSnhFLG9CQUFNMkUsS0FBSzNFLElBQUwsQ0FBVVQsV0FBVixFQURGO0FBRUpVLHFCQUFPLE1BQUtwQixPQUFMLENBQWFzRixhQUFiLEdBQTZCUSxLQUFLRSxRQUFMLEVBQTdCLEdBQStDRixLQUFLaEMsYUFBTDtBQUZsRCxhQUFOO0FBSUEyQixtQkFBTzFELElBQVAsQ0FBWTRELEdBQVo7QUFDQTtBQUNGLGVBQUssVUFBTDtBQUNFQSxrQkFBTTtBQUNKeEUsb0JBQU0yRSxLQUFLM0UsSUFBTCxDQUFVVCxXQUFWLEVBREY7QUFFSlUscUJBQU8wRSxLQUFLRSxRQUFMO0FBRkgsYUFBTjtBQUlBUCxtQkFBTzFELElBQVAsQ0FBWTRELEdBQVo7QUFDQTtBQUNGLGVBQUssTUFBTDtBQUNFLGdCQUFJRyxLQUFLQyxNQUFMLENBQVksS0FBWixFQUFtQixJQUFuQixDQUFKLEVBQThCO0FBQzVCTixxQkFBTzFELElBQVAsQ0FBWSxJQUFaO0FBQ0E7QUFDRDtBQUNENEQsa0JBQU07QUFDSnhFLG9CQUFNMkUsS0FBSzNFLElBQUwsQ0FBVVQsV0FBVixFQURGO0FBRUpVLHFCQUFPMEUsS0FBS0UsUUFBTDtBQUZILGFBQU47QUFJQVAsbUJBQU8xRCxJQUFQLENBQVk0RCxHQUFaO0FBQ0E7QUFDRixlQUFLLFNBQUw7QUFDRUYscUJBQVNBLE9BQU9BLE9BQU8vRCxNQUFQLEdBQWdCLENBQXZCLEVBQTBCdUUsT0FBMUIsR0FBb0MsRUFBN0M7QUFDQTtBQUNGLGVBQUssTUFBTDtBQUNFTixrQkFBTSxFQUFOO0FBQ0FGLG1CQUFPMUQsSUFBUCxDQUFZNEQsR0FBWjtBQUNBRixxQkFBU0UsR0FBVDtBQUNBO0FBQ0YsZUFBSyxTQUFMO0FBQ0VFLHNCQUFVQyxLQUFLRSxRQUFMLEdBQWdCRSxLQUFoQixDQUFzQixHQUF0QixFQUEyQkMsR0FBM0IsQ0FBK0JDLE1BQS9CLENBQVY7QUFDQVgsbUJBQU9BLE9BQU8vRCxNQUFQLEdBQWdCLENBQXZCLEVBQTBCbUUsT0FBMUIsR0FBb0NBLE9BQXBDO0FBQ0E7QUF0Q0o7O0FBeUNBQyxhQUFLckMsVUFBTCxDQUFnQlksT0FBaEIsQ0FBd0IsVUFBVWdDLFNBQVYsRUFBcUI7QUFDM0NYLGVBQUtXLFNBQUw7QUFDRCxTQUZEO0FBR0FaLGlCQUFTRyxTQUFUO0FBQ0QsT0E1REQ7O0FBOERBRixXQUFLLEtBQUtSLElBQVY7O0FBRUEsYUFBT25FLFVBQVA7QUFDRDs7OytCQUVXd0MsVSxFQUFZQyxRLEVBQVU7QUFDaEMsYUFBTyxJQUFJRixJQUFKLENBQVMsS0FBS2hDLFVBQWQsRUFBMEJpQyxVQUExQixFQUFzQ0MsUUFBdEMsQ0FBUDtBQUNEOzs7b0NBRWdCO0FBQUE7O0FBQ2YsVUFBSS9CLFVBQUo7QUFDQSxVQUFJNkUsWUFBSjtBQUNBLFVBQU1DLFVBQVUsU0FBVkEsT0FBVSxDQUFDL0QsR0FBRCxFQUFTO0FBQ3ZCO0FBQ0EsZUFBTyxPQUFLbEIsVUFBTCxDQUFnQkcsSUFBSSxDQUFwQixNQUEyQlkseUJBQWxDLEVBQStDO0FBQzdDWjtBQUNEO0FBQ0YsT0FMRDs7QUFPQSxXQUFLQSxJQUFJLENBQUosRUFBTzZFLE1BQU0sS0FBS2hGLFVBQUwsQ0FBZ0JJLE1BQWxDLEVBQTBDRCxJQUFJNkUsR0FBOUMsRUFBbUQ3RSxHQUFuRCxFQUF3RDtBQUN0RCxZQUFJaUIsTUFBTSxLQUFLcEIsVUFBTCxDQUFnQkcsQ0FBaEIsQ0FBVjs7QUFFQSxnQkFBUSxLQUFLNEQsS0FBYjtBQUNFLGVBQUssUUFBTDs7QUFFRSxvQkFBUTNDLEdBQVI7QUFDRTtBQUNBLG1CQUFLOEQsMEJBQUw7QUFDRSxxQkFBS3JCLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQzFELENBQWxDLENBQW5CO0FBQ0EscUJBQUswRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsUUFBeEI7QUFDQSxxQkFBS2tFLEtBQUwsR0FBYSxRQUFiO0FBQ0EscUJBQUtGLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixLQUExQjtBQUNBOztBQUVGO0FBQ0EsbUJBQUsrQyxvQ0FBTDtBQUNFLHFCQUFLdEIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDMUQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBSzBELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBLHFCQUFLZ0UsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUY7QUFDQSxtQkFBS2dELHFDQUFMO0FBQ0Usb0JBQUksS0FBS3ZCLFdBQUwsQ0FBaUJoRSxJQUFqQixLQUEwQixNQUE5QixFQUFzQztBQUNwQyx3QkFBTSxJQUFJZ0MsS0FBSixDQUFVLCtDQUErQyxLQUFLWCxHQUFMLEdBQVdmLENBQTFELENBQVYsQ0FBTjtBQUNEOztBQUVELHFCQUFLMEQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLENBQWlCd0IsTUFBakIsR0FBMEIsS0FBS25FLEdBQUwsR0FBV2YsQ0FBckM7QUFDQSxxQkFBSzBELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBZ0Q7QUFDQTs7QUFFRjtBQUNBLG1CQUFLdkQsaUNBQUw7QUFDRSxvQkFBSSxLQUFLbUMsV0FBTCxDQUFpQmhFLElBQWpCLEtBQTBCLFNBQTlCLEVBQXlDO0FBQ3ZDLHdCQUFNLElBQUlnQyxLQUFKLENBQVUsa0RBQWtELEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0QsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxxQkFBSzBELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLHFCQUFLeUIsV0FBTCxDQUFpQndCLE1BQWpCLEdBQTBCLEtBQUtuRSxHQUFMLEdBQVdmLENBQXJDO0FBQ0EscUJBQUswRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBZ0Q7QUFDQTs7QUFFRjtBQUNBLG1CQUFLSyxrQ0FBTDtBQUNFLG9CQUFJLEtBQUt0RixVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCdUIsaUNBQS9CLEVBQW9EO0FBQ2xELHVCQUFLbUMsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDMUQsQ0FBbEMsQ0FBbkI7QUFDQSx1QkFBSzBELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBLHVCQUFLZ0UsV0FBTCxDQUFpQnZCLFVBQWpCLEdBQThCbkMsQ0FBOUI7QUFDQSx1QkFBSzBELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QnBDLElBQUksQ0FBaEM7QUFDQSx1QkFBSzRELEtBQUwsR0FBYSxNQUFiO0FBQ0QsaUJBTkQsTUFNTztBQUNMLHVCQUFLRixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MxRCxDQUFsQyxDQUFuQjtBQUNBLHVCQUFLMEQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFNBQXhCO0FBQ0EsdUJBQUtrRSxLQUFMLEdBQWEsU0FBYjtBQUNBLHVCQUFLRixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDRDtBQUNEOztBQUVGO0FBQ0EsbUJBQUttRCxzQ0FBTDtBQUNFLHFCQUFLMUIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDMUQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBSzBELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixTQUF4QjtBQUNBLHFCQUFLa0UsS0FBTCxHQUFhLFNBQWI7QUFDQSxxQkFBS0YsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUY7QUFDQSxtQkFBS2YsNEJBQUw7QUFDRSxxQkFBS3dDLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQzFELENBQWxDLENBQW5CO0FBQ0EscUJBQUswRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsVUFBeEI7QUFDQSxxQkFBS2dFLFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4Qm5DLENBQTlCO0FBQ0EscUJBQUswRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEJwQyxJQUFJLENBQWhDO0FBQ0EscUJBQUswRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDQSxxQkFBSzJCLEtBQUwsR0FBYSxVQUFiO0FBQ0E7O0FBRUY7QUFDQSxtQkFBS2hELHlCQUFMO0FBQ0U7QUFDQTs7QUFFRjtBQUNBLG1CQUFLWSxnQ0FBTDtBQUNFO0FBQ0Esb0JBQUksQ0FBQyxJQUFELEVBQU8sSUFBUCxFQUFhLEtBQWIsRUFBb0IsS0FBcEIsRUFBMkIsU0FBM0IsRUFBc0N4QyxPQUF0QyxDQUE4QyxLQUFLd0UsTUFBTCxDQUFZMUUsT0FBWixDQUFvQkcsV0FBcEIsRUFBOUMsS0FBb0YsQ0FBcEYsSUFBeUYsS0FBS3lFLFdBQUwsS0FBcUIsS0FBS0QsSUFBdkgsRUFBNkg7QUFDM0gsdUJBQUtDLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQzs7QUFFQSx1QkFBSzBELFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQzFELENBQWxDLENBQW5CO0FBQ0EsdUJBQUswRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7O0FBRUEsdUJBQUtnRSxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MxRCxDQUFsQyxDQUFuQjtBQUNBLHVCQUFLMEQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFNBQXhCO0FBQ0EsdUJBQUtnRSxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDQSx1QkFBSzJCLEtBQUwsR0FBYSxRQUFiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQUloRSxhQUFhLEtBQUtDLFVBQUwsQ0FBZ0JZLFFBQWhCLENBQXlCVCxJQUFJLENBQTdCLEVBQWdDQSxJQUFJLEVBQXBDLENBQWIsRUFBc0RmLFdBQXRELE9BQXdFLFdBQTVFLEVBQXlGO0FBQ3ZGO0FBQ0EseUJBQUt5RSxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBSzNDLEdBQUwsR0FBV2YsQ0FBWCxHQUFlLENBQWpELENBQW5CO0FBQ0EseUJBQUswRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7QUFDQSx5QkFBS2dFLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFYLEdBQWUsQ0FBekM7QUFDQSx5QkFBSzBELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4Qm5DLElBQUksQ0FBbEM7QUFDQSx5QkFBSzBELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QnBDLElBQUksQ0FBaEM7QUFDQSx5QkFBSzBELFdBQUwsQ0FBaUJwQixnQkFBakIsR0FBb0MsSUFBcEM7QUFDQSx5QkFBS29CLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBO0FBQ0EseUJBQUs0QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBSzNDLEdBQUwsR0FBV2YsQ0FBWCxHQUFlLEVBQWpELENBQW5CO0FBQ0E7QUFDQSx5QkFBSzBELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBO0FBQ0FNLHdCQUFJLEtBQUtILFVBQUwsQ0FBZ0JiLE9BQWhCLENBQXdCdUMsaUNBQXhCLEVBQTZDdkIsSUFBSSxFQUFqRCxDQUFKO0FBQ0EseUJBQUswRCxXQUFMLENBQWlCd0IsTUFBakIsR0FBMEIsS0FBS25FLEdBQUwsR0FBV2YsQ0FBWCxHQUFlLENBQXpDO0FBQ0EseUJBQUswRCxXQUFMLENBQWlCdkIsVUFBakIsR0FBOEIsS0FBS3VCLFdBQUwsQ0FBaUIzQixRQUFqQixHQUE0QixLQUFLaEIsR0FBL0Q7QUFDQSx5QkFBSzJDLFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QixLQUFLc0IsV0FBTCxDQUFpQndCLE1BQWpCLEdBQTBCLEtBQUtuRSxHQUEvQixHQUFxQyxDQUFqRTtBQUNBLHlCQUFLMkMsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7O0FBRUE7QUFDQSx5QkFBSzRCLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLHlCQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQWdEO0FBQ0Q7O0FBRUQ7QUFDRDtBQUNIO0FBQ0E7QUFDRTtBQUNBO0FBQ0E7QUFDQSxvQkFBSSxDQUFDLGdDQUFhN0QsR0FBYixDQUFELElBQXNCQSxRQUFRb0UsNkJBQTlCLElBQWlEcEUsUUFBUXFFLGdDQUE3RCxFQUFpRjtBQUMvRSx3QkFBTSxJQUFJNUQsS0FBSixDQUFVLGtDQUFrQyxLQUFLWCxHQUFMLEdBQVdmLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELHFCQUFLMEQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDMUQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBSzBELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBLHFCQUFLZ0UsV0FBTCxDQUFpQnZCLFVBQWpCLEdBQThCbkMsQ0FBOUI7QUFDQSxxQkFBSzBELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QnBDLElBQUksQ0FBaEM7QUFDQSxxQkFBSzRELEtBQUwsR0FBYSxNQUFiO0FBQ0E7QUE1SUo7QUE4SUE7O0FBRUYsZUFBSyxNQUFMOztBQUVFO0FBQ0EsZ0JBQUkzQyxRQUFRTCx5QkFBWixFQUF5QjtBQUN2QixtQkFBSzhDLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBSzBELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQSxnQkFDRSxLQUFLRixXQUFMLENBQWlCNUIsVUFBakIsS0FFR2IsUUFBUWdFLHFDQUFSLElBQW1DLEtBQUt2QixXQUFMLENBQWlCNUIsVUFBakIsQ0FBNEJwQyxJQUE1QixLQUFxQyxNQUF6RSxJQUNDdUIsUUFBUU0saUNBQVIsSUFBK0IsS0FBS21DLFdBQUwsQ0FBaUI1QixVQUFqQixDQUE0QnBDLElBQTVCLEtBQXFDLFNBSHZFLENBREYsRUFNRTtBQUNBLG1CQUFLZ0UsV0FBTCxDQUFpQndCLE1BQWpCLEdBQTBCLEtBQUtuRSxHQUFMLEdBQVdmLENBQVgsR0FBZSxDQUF6QztBQUNBLG1CQUFLMEQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7O0FBRUEsbUJBQUs0QixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBS3lCLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQztBQUNBLG1CQUFLMEQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiOztBQUVBa0I7QUFDQTtBQUNEOztBQUVELGdCQUFJLENBQUM3RCxRQUFRc0UseUJBQVIsSUFBdUJ0RSxRQUFRdUUseUJBQWhDLEtBQWdELEtBQUs5QixXQUFMLENBQWlCK0IsUUFBakIsRUFBcEQsRUFBaUY7QUFDL0UsbUJBQUsvQixXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsVUFBeEI7QUFDQSxtQkFBS2dFLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLMkIsS0FBTCxHQUFhLFVBQWI7QUFDRDs7QUFFRDtBQUNBLGdCQUFJM0MsUUFBUU8sZ0NBQVIsS0FBK0IsS0FBS2tDLFdBQUwsQ0FBaUJZLE1BQWpCLENBQXdCLE1BQXhCLEVBQWdDLEtBQWhDLEtBQTBDLEtBQUtaLFdBQUwsQ0FBaUJZLE1BQWpCLENBQXdCLFdBQXhCLEVBQXFDLEtBQXJDLENBQXpFLENBQUosRUFBMkg7QUFDekgsbUJBQUtaLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQztBQUNBLG1CQUFLMEQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQUwsQ0FBaUI1QixVQUFqQyxFQUE2QyxLQUFLZixHQUFMLEdBQVdmLENBQXhELENBQW5CO0FBQ0EsbUJBQUswRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsU0FBeEI7QUFDQSxtQkFBS2dFLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixLQUExQjtBQUNBLG1CQUFLMkIsS0FBTCxHQUFhLFFBQWI7QUFDQTtBQUNEOztBQUVELGdCQUFJM0MsUUFBUWtFLGtDQUFaLEVBQWtDO0FBQ2hDLG9CQUFNLElBQUl6RCxLQUFKLENBQVUsNkNBQTZDLEtBQUtYLEdBQTVELENBQU47QUFDRDs7QUFFRDtBQUNBLGdCQUFJLENBQUMsZ0NBQWFFLEdBQWIsQ0FBRCxJQUFzQkEsUUFBUU0saUNBQTlCLElBQXFELEVBQUVOLFFBQVFDLDRCQUFSLElBQTBCLEtBQUt3QyxXQUFMLENBQWlCWSxNQUFqQixDQUF3QixJQUF4QixDQUE1QixDQUF6RCxFQUFxSDtBQUNuSCxvQkFBTSxJQUFJNUMsS0FBSixDQUFVLGtDQUFrQyxLQUFLWCxHQUFMLEdBQVdmLENBQTdDLENBQVYsQ0FBTjtBQUNELGFBRkQsTUFFTyxJQUFJLEtBQUswRCxXQUFMLENBQWlCWSxNQUFqQixDQUF3QixLQUF4QixDQUFKLEVBQW9DO0FBQ3pDLG9CQUFNLElBQUk1QyxLQUFKLENBQVUsa0NBQWtDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsaUJBQUswRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEJwQyxJQUFJLENBQWhDO0FBQ0E7O0FBRUYsZUFBSyxRQUFMOztBQUVFO0FBQ0EsZ0JBQUlpQixRQUFROEQsMEJBQVosRUFBMEI7QUFDeEIsbUJBQUtyQixXQUFMLENBQWlCd0IsTUFBakIsR0FBMEIsS0FBS25FLEdBQUwsR0FBV2YsQ0FBckM7QUFDQSxtQkFBSzBELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiOztBQUVBa0I7QUFDQTtBQUNEOztBQUVEO0FBQ0EsZ0JBQUk3RCxRQUFRb0UsNkJBQVosRUFBNkI7QUFDM0IsbUJBQUszQixXQUFMLENBQWlCeEIsU0FBakIsQ0FBMkI1QixJQUEzQixDQUFnQ04sSUFBSSxLQUFLMEQsV0FBTCxDQUFpQnZCLFVBQXJEO0FBQ0FuQztBQUNBLGtCQUFJQSxLQUFLNkUsR0FBVCxFQUFjO0FBQ1osc0JBQU0sSUFBSW5ELEtBQUosQ0FBVSwwQ0FBMEMsS0FBS1gsR0FBTCxHQUFXZixDQUFyRCxDQUFWLENBQU47QUFDRDtBQUNEaUIsb0JBQU0sS0FBS3BCLFVBQUwsQ0FBZ0JHLENBQWhCLENBQU47QUFDRDs7QUFFRDs7Ozs7O0FBTUEsaUJBQUswRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEJwQyxJQUFJLENBQWhDO0FBQ0E7O0FBRUYsZUFBSyxTQUFMO0FBQ0UsZ0JBQUlpQixRQUFReUUscUNBQVosRUFBcUM7QUFDbkMsa0JBQUksS0FBS2hDLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBSixFQUF3QztBQUN0QyxzQkFBTSxJQUFJdkIsS0FBSixDQUFVLDJDQUEyQyxLQUFLWCxHQUExRCxDQUFOO0FBQ0Q7QUFDRCxtQkFBSzJDLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQztBQUNBLG1CQUFLMEQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EsbUJBQUt5QixXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLG1CQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQWtCO0FBQ0E7QUFDRDs7QUFFRCxnQkFBSTdELFFBQVEwRSw2QkFBUixLQUE0QixDQUFDLEtBQUtqQyxXQUFMLENBQWlCVixjQUFqQixFQUFELElBQXNDLEtBQUtVLFdBQUwsQ0FBaUJrQyxZQUFqQixDQUE4QixHQUE5QixDQUFsRSxDQUFKLEVBQTJHO0FBQ3pHLG9CQUFNLElBQUlsRSxLQUFKLENBQVUsZ0RBQWdELEtBQUtYLEdBQS9ELENBQU47QUFDRDs7QUFFRCxnQkFBSSxDQUFDLDRCQUFTRSxHQUFULENBQUQsSUFBa0JBLFFBQVEwRSw2QkFBOUIsRUFBK0M7QUFDN0Msb0JBQU0sSUFBSWpFLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS1gsR0FBTCxHQUFXZixDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSWlCLFFBQVEwRSw2QkFBUixLQUE0QixLQUFLakMsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsR0FBeEIsS0FBZ0MsS0FBS1osV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsSUFBMUIsRUFBZ0MsQ0FBQyxDQUFqQyxDQUE1RCxDQUFKLEVBQXNHO0FBQ3BHLG9CQUFNLElBQUl2QixLQUFKLENBQVUsa0NBQWtDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsaUJBQUswRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEJwQyxJQUFJLENBQWhDO0FBQ0E7O0FBRUYsZUFBSyxTQUFMO0FBQ0UsZ0JBQUksS0FBSzBELFdBQUwsQ0FBaUJtQyxPQUFyQixFQUE4QjtBQUM1QixrQkFBSTVFLFFBQVEsQ0FBWixFQUFlO0FBQ2Isc0JBQU0sSUFBSVMsS0FBSixDQUFVLG1DQUFtQyxLQUFLWCxHQUFMLEdBQVdmLENBQTlDLENBQVYsQ0FBTjtBQUNEO0FBQ0QsbUJBQUswRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEJwQyxJQUFJLENBQWhDOztBQUVBLGtCQUFJLEtBQUswRCxXQUFMLENBQWlCVixjQUFqQixNQUFxQyxLQUFLVSxXQUFMLENBQWlCb0MsYUFBMUQsRUFBeUU7QUFDdkUscUJBQUtwQyxXQUFMLENBQWlCd0IsTUFBakIsR0FBMEIsS0FBS25FLEdBQUwsR0FBV2YsQ0FBckM7QUFDQSxxQkFBSzBELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLHFCQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxxQkFBSzhCLEtBQUwsR0FBYSxRQUFiO0FBQ0FrQjtBQUNEO0FBQ0Q7QUFDRDs7QUFFRCxnQkFBSTdELFFBQVFFLHdCQUFSLElBQXNCLEtBQUs1QyxPQUFMLENBQWF3SCxXQUF2QyxFQUFvRDtBQUNsRCxtQkFBS3JDLFdBQUwsQ0FBaUJxQyxXQUFqQixHQUErQixJQUEvQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUk5RSxRQUFRK0UsdUNBQVosRUFBdUM7QUFDckMsa0JBQUksRUFBRSxtQkFBbUIsS0FBS3RDLFdBQTFCLENBQUosRUFBNEM7QUFDMUMsc0JBQU0sSUFBSWhDLEtBQUosQ0FBVSx1REFBdUQsS0FBS1gsR0FBTCxHQUFXZixDQUFsRSxDQUFWLENBQU47QUFDRDtBQUNELGtCQUFJLEtBQUtILFVBQUwsQ0FBZ0JHLElBQUksQ0FBcEIsTUFBMkJpRyxzQkFBL0IsRUFBeUM7QUFDdkNqRztBQUNELGVBRkQsTUFFTyxJQUFJLEtBQUtILFVBQUwsQ0FBZ0JHLElBQUksQ0FBcEIsTUFBMkJrRyxzQkFBM0IsSUFBdUMsS0FBS3JHLFVBQUwsQ0FBZ0JHLElBQUksQ0FBcEIsTUFBMkJpRyxzQkFBdEUsRUFBZ0Y7QUFDckZqRyxxQkFBSyxDQUFMO0FBQ0QsZUFGTSxNQUVBO0FBQ0wsc0JBQU0sSUFBSTBCLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS1gsR0FBTCxHQUFXZixDQUE3QyxDQUFWLENBQU47QUFDRDtBQUNELG1CQUFLMEQsV0FBTCxDQUFpQnZCLFVBQWpCLEdBQThCbkMsSUFBSSxDQUFsQztBQUNBLG1CQUFLMEQsV0FBTCxDQUFpQm9DLGFBQWpCLEdBQWlDbkIsT0FBTyxLQUFLakIsV0FBTCxDQUFpQm9DLGFBQXhCLENBQWpDO0FBQ0EsbUJBQUtwQyxXQUFMLENBQWlCbUMsT0FBakIsR0FBMkIsSUFBM0I7O0FBRUEsa0JBQUksQ0FBQyxLQUFLbkMsV0FBTCxDQUFpQm9DLGFBQXRCLEVBQXFDO0FBQ25DO0FBQ0E7QUFDQSxxQkFBS3BDLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQztBQUNBLHFCQUFLMEQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLHFCQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQWtCO0FBQ0Q7QUFDRDtBQUNEO0FBQ0QsZ0JBQUksQ0FBQyw0QkFBUzdELEdBQVQsQ0FBTCxFQUFvQjtBQUNsQixvQkFBTSxJQUFJUyxLQUFKLENBQVUsa0NBQWtDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxnQkFBSSxLQUFLMEQsV0FBTCxDQUFpQm9DLGFBQWpCLEtBQW1DLEdBQXZDLEVBQTRDO0FBQzFDLG9CQUFNLElBQUlwRSxLQUFKLENBQVUsa0NBQWtDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxpQkFBSzBELFdBQUwsQ0FBaUJvQyxhQUFqQixHQUFpQyxDQUFDLEtBQUtwQyxXQUFMLENBQWlCb0MsYUFBakIsSUFBa0MsRUFBbkMsSUFBeUN2RixPQUFPWCxZQUFQLENBQW9CcUIsR0FBcEIsQ0FBMUU7QUFDQTs7QUFFRixlQUFLLFVBQUw7QUFDRTtBQUNBLGdCQUFJQSxRQUFRTCx5QkFBWixFQUF5QjtBQUN2QixrQkFBSSxDQUFDLEtBQUs4QyxXQUFMLENBQWlCTCxPQUFqQixDQUF5QixDQUFDLENBQTFCLENBQUQsSUFBaUMsQ0FBQyxLQUFLSyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQXRDLEVBQTBFO0FBQ3hFLHNCQUFNLElBQUl2QixLQUFKLENBQVUsd0NBQXdDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsa0JBQUksS0FBSzBELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl2QixLQUFKLENBQVUsd0NBQXdDLEtBQUtYLEdBQUwsR0FBV2YsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsbUJBQUswRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBS3lCLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBSzBELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0QsYUFkRCxNQWNPLElBQUksS0FBS0YsV0FBTCxDQUFpQjVCLFVBQWpCLElBQ1RiLFFBQVFNLGlDQURDLElBRVQsS0FBS21DLFdBQUwsQ0FBaUI1QixVQUFqQixDQUE0QnBDLElBQTVCLEtBQXFDLFNBRmhDLEVBRTJDO0FBQ2hELG1CQUFLZ0UsV0FBTCxDQUFpQndCLE1BQWpCLEdBQTBCLEtBQUtuRSxHQUFMLEdBQVdmLENBQVgsR0FBZSxDQUF6QztBQUNBLG1CQUFLMEQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7O0FBRUEsbUJBQUs0QixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBS3lCLFdBQUwsQ0FBaUJ3QixNQUFqQixHQUEwQixLQUFLbkUsR0FBTCxHQUFXZixDQUFyQztBQUNBLG1CQUFLMEQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiOztBQUVBa0I7QUFDQTtBQUNEOztBQUVELGdCQUFJN0QsUUFBUXVFLHlCQUFaLEVBQXlCO0FBQ3ZCLGtCQUFJLENBQUMsS0FBSzlCLFdBQUwsQ0FBaUJMLE9BQWpCLENBQXlCLENBQUMsQ0FBMUIsQ0FBRCxJQUFpQyxDQUFDLEtBQUtLLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEMsRUFBMEU7QUFDeEUsc0JBQU0sSUFBSXZCLEtBQUosQ0FBVSwrQ0FBK0MsS0FBS1gsR0FBTCxHQUFXZixDQUExRCxDQUFWLENBQU47QUFDRDtBQUNGLGFBSkQsTUFJTyxJQUFJaUIsUUFBUUMsNEJBQVosRUFBNEI7QUFDakMsa0JBQUksQ0FBQyxLQUFLd0MsV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUFELElBQXVDLENBQUMsS0FBS1MsV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUE1QyxFQUFnRjtBQUM5RSxzQkFBTSxJQUFJdkIsS0FBSixDQUFVLDRDQUE0QyxLQUFLWCxHQUFMLEdBQVdmLENBQXZELENBQVYsQ0FBTjtBQUNEO0FBQ0YsYUFKTSxNQUlBLElBQUlpQixRQUFRc0UseUJBQVosRUFBeUI7QUFDOUIsa0JBQUksQ0FBQyxLQUFLN0IsV0FBTCxDQUFpQkwsT0FBakIsQ0FBeUIsQ0FBQyxDQUExQixDQUFELElBQWlDLENBQUMsS0FBS0ssV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUF0QyxFQUEwRTtBQUN4RSxzQkFBTSxJQUFJdkIsS0FBSixDQUFVLGtEQUFrRCxLQUFLWCxHQUFMLEdBQVdmLENBQTdELENBQVYsQ0FBTjtBQUNEO0FBQ0Qsa0JBQUksS0FBSzBELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl2QixLQUFKLENBQVUsa0RBQWtELEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0QsQ0FBVixDQUFOO0FBQ0Q7QUFDRixhQVBNLE1BT0EsSUFBSSxDQUFDLDRCQUFTaUIsR0FBVCxDQUFMLEVBQW9CO0FBQ3pCLG9CQUFNLElBQUlTLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS1gsR0FBTCxHQUFXZixDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSSw0QkFBU2lCLEdBQVQsS0FBaUIsS0FBS3lDLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBckIsRUFBeUQ7QUFDdkQsb0JBQU0sSUFBSXZCLEtBQUosQ0FBVSxvQ0FBb0MsS0FBS1gsR0FBTCxHQUFXZixDQUEvQyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBSzBELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QnBDLElBQUksQ0FBaEM7QUFDQTtBQTNYSjtBQTZYRDtBQUNGIiwiZmlsZSI6InBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEFTQ0lJX0FTVEVSSVNLLFxuICBBU0NJSV9CQUNLU0xBU0gsXG4gIEFTQ0lJX0NPTE9OLFxuICBBU0NJSV9DT01NQSxcbiAgQVNDSUlfQ1IsXG4gIEFTQ0lJX0RRVU9URSxcbiAgQVNDSUlfRlVMTF9TVE9QLFxuICBBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTixcbiAgQVNDSUlfTEVGVF9CUkFDS0VULFxuICBBU0NJSV9MRUZUX0NVUkxZX0JSQUNLRVQsXG4gIEFTQ0lJX0xFRlRfUEFSRU5USEVTSVMsXG4gIEFTQ0lJX0xFU1NfVEhBTl9TSUdOLFxuICBBU0NJSV9OTCxcbiAgQVNDSUlfUEVSQ0VOVF9TSUdOLFxuICBBU0NJSV9QTFVTLFxuICBBU0NJSV9SSUdIVF9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyxcbiAgQVNDSUlfU1BBQ0UsXG4gIElTX0NPTU1BTkQsXG4gIElTX0RJR0lULFxuICBJU19BVE9NX0NIQVIsXG4gIElTX1RBR1xufSBmcm9tICcuL2Zvcm1hbC1zeW50YXgnXG5cbmZ1bmN0aW9uIGZyb21DaGFyQ29kZSAodWludDhBcnJheSkge1xuICBjb25zdCBiYXRjaFNpemUgPSAxMDI0MFxuICB2YXIgc3RyaW5ncyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB1aW50OEFycmF5Lmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICBjb25zdCBiZWdpbiA9IGlcbiAgICBjb25zdCBlbmQgPSBNYXRoLm1pbihpICsgYmF0Y2hTaXplLCB1aW50OEFycmF5Lmxlbmd0aClcbiAgICBzdHJpbmdzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCB1aW50OEFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpKSlcbiAgfVxuXG4gIHJldHVybiBzdHJpbmdzLmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21DaGFyQ29kZVRyaW1tZWQgKHVpbnQ4QXJyYXkpIHtcbiAgbGV0IGJlZ2luID0gMFxuICBsZXQgZW5kID0gdWludDhBcnJheS5sZW5ndGhcblxuICB3aGlsZSAodWludDhBcnJheVtiZWdpbl0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgYmVnaW4rK1xuICB9XG5cbiAgd2hpbGUgKHVpbnQ4QXJyYXlbZW5kIC0gMV0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgZW5kLS1cbiAgfVxuXG4gIGlmIChiZWdpbiAhPT0gMCB8fCBlbmQgIT09IHVpbnQ4QXJyYXkubGVuZ3RoKSB7XG4gICAgdWludDhBcnJheSA9IHVpbnQ4QXJyYXkuc3ViYXJyYXkoYmVnaW4sIGVuZClcbiAgfVxuXG4gIHJldHVybiBmcm9tQ2hhckNvZGUodWludDhBcnJheSlcbn1cblxuZnVuY3Rpb24gaXNFbXB0eSAodWludDhBcnJheSkge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHVpbnQ4QXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodWludDhBcnJheVtpXSAhPT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlXG59XG5cbmNsYXNzIFBhcnNlckluc3RhbmNlIHtcbiAgY29uc3RydWN0b3IgKGlucHV0LCBvcHRpb25zKSB7XG4gICAgdGhpcy5yZW1haW5kZXIgPSBuZXcgVWludDhBcnJheShpbnB1dCB8fCAwKVxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB0aGlzLnBvcyA9IDBcbiAgfVxuICBnZXRUYWcgKCkge1xuICAgIGlmICghdGhpcy50YWcpIHtcbiAgICAgIGNvbnN0IHN5bnRheENoZWNrZXIgPSAoY2hyKSA9PiBJU19UQUcoY2hyKSB8fCBjaHIgPT09IEFTQ0lJX0FTVEVSSVNLIHx8IGNociA9PT0gQVNDSUlfUExVU1xuICAgICAgdGhpcy50YWcgPSB0aGlzLmdldEVsZW1lbnQoc3ludGF4Q2hlY2tlcilcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudGFnXG4gIH1cblxuICBnZXRDb21tYW5kICgpIHtcbiAgICBpZiAoIXRoaXMuY29tbWFuZCkge1xuICAgICAgdGhpcy5jb21tYW5kID0gdGhpcy5nZXRFbGVtZW50KElTX0NPTU1BTkQpXG4gICAgfVxuXG4gICAgc3dpdGNoICgodGhpcy5jb21tYW5kIHx8ICcnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ09LJzpcbiAgICAgIGNhc2UgJ05PJzpcbiAgICAgIGNhc2UgJ0JBRCc6XG4gICAgICBjYXNlICdQUkVBVVRIJzpcbiAgICAgIGNhc2UgJ0JZRSc6XG4gICAgICAgIGxldCBsYXN0UmlnaHRCcmFja2V0ID0gdGhpcy5yZW1haW5kZXIubGFzdEluZGV4T2YoQVNDSUlfUklHSFRfQlJBQ0tFVClcbiAgICAgICAgaWYgKHRoaXMucmVtYWluZGVyWzFdID09PSBBU0NJSV9MRUZUX0JSQUNLRVQgJiYgbGFzdFJpZ2h0QnJhY2tldCA+IDEpIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGxhc3RSaWdodEJyYWNrZXQgKyAxKSlcbiAgICAgICAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDAsIGxhc3RSaWdodEJyYWNrZXQgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaHVtYW5SZWFkYWJsZSA9IGZyb21DaGFyQ29kZVRyaW1tZWQodGhpcy5yZW1haW5kZXIpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSBuZXcgVWludDhBcnJheSgwKVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29tbWFuZFxuICB9XG5cbiAgZ2V0RWxlbWVudCAoc3ludGF4Q2hlY2tlcikge1xuICAgIGxldCBlbGVtZW50XG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGxldCBmaXJzdFNwYWNlID0gdGhpcy5yZW1haW5kZXIuaW5kZXhPZihBU0NJSV9TUEFDRSlcbiAgICBpZiAodGhpcy5yZW1haW5kZXIubGVuZ3RoID4gMCAmJiBmaXJzdFNwYWNlICE9PSAwKSB7XG4gICAgICBpZiAoZmlyc3RTcGFjZSA9PT0gLTEpIHtcbiAgICAgICAgZWxlbWVudCA9IHRoaXMucmVtYWluZGVyXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50ID0gdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoMCwgZmlyc3RTcGFjZSlcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghc3ludGF4Q2hlY2tlcihlbGVtZW50W2ldKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBlbGVtZW50Lmxlbmd0aFxuICAgIHRoaXMucmVtYWluZGVyID0gdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoZWxlbWVudC5sZW5ndGgpXG5cbiAgICByZXR1cm4gZnJvbUNoYXJDb2RlKGVsZW1lbnQpXG4gIH1cblxuICBnZXRTcGFjZSAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSAhPT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcysrXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgxKVxuICB9XG5cbiAgZ2V0QXR0cmlidXRlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRva2VuUGFyc2VyKHRoaXMsIHRoaXMucG9zLCB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgpLCB0aGlzLm9wdGlvbnMpLmdldEF0dHJpYnV0ZXMoKVxuICB9XG59XG5cbmNsYXNzIE5vZGUge1xuICBjb25zdHJ1Y3RvciAodWludDhBcnJheSwgcGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5jaGlsZE5vZGVzID0gW11cbiAgICB0aGlzLnR5cGUgPSBmYWxzZVxuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZVxuICAgIHRoaXMudmFsdWVTa2lwID0gW11cbiAgICB0aGlzLnN0YXJ0UG9zID0gc3RhcnRQb3NcbiAgICB0aGlzLnZhbHVlU3RhcnQgPSB0aGlzLnZhbHVlRW5kID0gdHlwZW9mIHN0YXJ0UG9zID09PSAnbnVtYmVyJyA/IHN0YXJ0UG9zICsgMSA6IDBcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLnBhcmVudE5vZGUgPSBwYXJlbnROb2RlXG4gICAgICBwYXJlbnROb2RlLmNoaWxkTm9kZXMucHVzaCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIGdldFZhbHVlICgpIHtcbiAgICBsZXQgdmFsdWUgPSBmcm9tQ2hhckNvZGUodGhpcy5nZXRWYWx1ZUFycmF5KCkpXG4gICAgcmV0dXJuIHRoaXMudmFsdWVUb1VwcGVyQ2FzZSA/IHZhbHVlLnRvVXBwZXJDYXNlKCkgOiB2YWx1ZVxuICB9XG5cbiAgZ2V0VmFsdWVMZW5ndGggKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0IC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoXG4gIH1cblxuICBnZXRWYWx1ZUFycmF5ICgpIHtcbiAgICBjb25zdCB2YWx1ZUFycmF5ID0gdGhpcy51aW50OEFycmF5LnN1YmFycmF5KHRoaXMudmFsdWVTdGFydCwgdGhpcy52YWx1ZUVuZClcblxuICAgIGlmICh0aGlzLnZhbHVlU2tpcC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB2YWx1ZUFycmF5XG4gICAgfVxuXG4gICAgbGV0IGZpbHRlcmVkQXJyYXkgPSBuZXcgVWludDhBcnJheSh2YWx1ZUFycmF5Lmxlbmd0aCAtIHRoaXMudmFsdWVTa2lwLmxlbmd0aClcbiAgICBsZXQgYmVnaW4gPSAwXG4gICAgbGV0IG9mZnNldCA9IDBcbiAgICBsZXQgc2tpcCA9IHRoaXMudmFsdWVTa2lwLnNsaWNlKClcblxuICAgIHNraXAucHVzaCh2YWx1ZUFycmF5Lmxlbmd0aClcblxuICAgIHNraXAuZm9yRWFjaChmdW5jdGlvbiAoZW5kKSB7XG4gICAgICBpZiAoZW5kID4gYmVnaW4pIHtcbiAgICAgICAgdmFyIHN1YkFycmF5ID0gdmFsdWVBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICAgICAgICBmaWx0ZXJlZEFycmF5LnNldChzdWJBcnJheSwgb2Zmc2V0KVxuICAgICAgICBvZmZzZXQgKz0gc3ViQXJyYXkubGVuZ3RoXG4gICAgICB9XG4gICAgICBiZWdpbiA9IGVuZCArIDFcbiAgICB9KVxuXG4gICAgcmV0dXJuIGZpbHRlcmVkQXJyYXlcbiAgfVxuXG4gIGVxdWFscyAodmFsdWUsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICBpZiAodGhpcy5nZXRWYWx1ZUxlbmd0aCgpICE9PSB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVxdWFsc0F0KHZhbHVlLCAwLCBjYXNlU2Vuc2l0aXZlKVxuICB9XG5cbiAgZXF1YWxzQXQgKHZhbHVlLCBpbmRleCwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGNhc2VTZW5zaXRpdmUgPSB0eXBlb2YgY2FzZVNlbnNpdGl2ZSA9PT0gJ2Jvb2xlYW4nID8gY2FzZVNlbnNpdGl2ZSA6IHRydWVcblxuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGluZGV4IC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cblxuICAgICAgaWYgKGluZGV4ID49IHRoaXMudmFsdWVFbmQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGxldCB1aW50OENoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gICAgICBsZXQgY2hhciA9IHZhbHVlW2ldXG5cbiAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICB1aW50OENoYXIgPSB1aW50OENoYXIudG9VcHBlckNhc2UoKVxuICAgICAgICBjaGFyID0gY2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICB9XG5cbiAgICAgIGlmICh1aW50OENoYXIgIT09IGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGluZGV4KytcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaXNOdW1iZXIgKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52YWx1ZUVuZCAtIHRoaXMudmFsdWVTdGFydDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5pc0RpZ2l0KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc0RpZ2l0IChpbmRleCkge1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIElTX0RJR0lUKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gIH1cblxuICBjb250YWluc0NoYXIgKGNoYXIpIHtcbiAgICBsZXQgYXNjaWkgPSBjaGFyLmNoYXJDb2RlQXQoMClcblxuICAgIGZvciAobGV0IGkgPSB0aGlzLnZhbHVlU3RhcnQ7IGkgPCB0aGlzLnZhbHVlRW5kOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkgLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpXSA9PT0gYXNjaWkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5jbGFzcyBUb2tlblBhcnNlciB7XG4gIGNvbnN0cnVjdG9yIChwYXJlbnQsIHN0YXJ0UG9zLCB1aW50OEFycmF5LCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9uc1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50XG5cbiAgICB0aGlzLnRyZWUgPSB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKClcbiAgICB0aGlzLnBvcyA9IHN0YXJ0UG9zIHx8IDBcblxuICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdUUkVFJ1xuXG4gICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPSB0cnVlXG4gICAgfVxuXG4gICAgdGhpcy5wcm9jZXNzU3RyaW5nKClcbiAgfVxuXG4gIGdldEF0dHJpYnV0ZXMgKCkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0gW11cbiAgICBsZXQgYnJhbmNoID0gYXR0cmlidXRlc1xuXG4gICAgbGV0IHdhbGsgPSBub2RlID0+IHtcbiAgICAgIGxldCBlbG1cbiAgICAgIGxldCBjdXJCcmFuY2ggPSBicmFuY2hcbiAgICAgIGxldCBwYXJ0aWFsXG5cbiAgICAgIGlmICghbm9kZS5jbG9zZWQgJiYgbm9kZS50eXBlID09PSAnU0VRVUVOQ0UnICYmIG5vZGUuZXF1YWxzKCcqJykpIHtcbiAgICAgICAgbm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgIG5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgbm9kZSB3YXMgbmV2ZXIgY2xvc2VkLCB0aHJvdyBpdFxuICAgICAgaWYgKCFub2RlLmNsb3NlZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyB0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoIC0gMSkpXG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAobm9kZS50eXBlLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgIGNhc2UgJ1NUUklORyc6XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPyBub2RlLmdldFZhbHVlKCkgOiBub2RlLmdldFZhbHVlQXJyYXkoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQVRPTSc6XG4gICAgICAgICAgaWYgKG5vZGUuZXF1YWxzKCdOSUwnLCB0cnVlKSkge1xuICAgICAgICAgICAgYnJhbmNoLnB1c2gobnVsbClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VDVElPTic6XG4gICAgICAgICAgYnJhbmNoID0gYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5zZWN0aW9uID0gW11cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdMSVNUJzpcbiAgICAgICAgICBlbG0gPSBbXVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmFuY2ggPSBlbG1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBwYXJ0aWFsID0gbm9kZS5nZXRWYWx1ZSgpLnNwbGl0KCcuJykubWFwKE51bWJlcilcbiAgICAgICAgICBicmFuY2hbYnJhbmNoLmxlbmd0aCAtIDFdLnBhcnRpYWwgPSBwYXJ0aWFsXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cblxuICAgICAgbm9kZS5jaGlsZE5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICB3YWxrKGNoaWxkTm9kZSlcbiAgICAgIH0pXG4gICAgICBicmFuY2ggPSBjdXJCcmFuY2hcbiAgICB9XG5cbiAgICB3YWxrKHRoaXMudHJlZSlcblxuICAgIHJldHVybiBhdHRyaWJ1dGVzXG4gIH1cblxuICBjcmVhdGVOb2RlIChwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHJldHVybiBuZXcgTm9kZSh0aGlzLnVpbnQ4QXJyYXksIHBhcmVudE5vZGUsIHN0YXJ0UG9zKVxuICB9XG5cbiAgcHJvY2Vzc1N0cmluZyAoKSB7XG4gICAgbGV0IGlcbiAgICBsZXQgbGVuXG4gICAgY29uc3QgY2hlY2tTUCA9IChwb3MpID0+IHtcbiAgICAgIC8vIGp1bXAgdG8gdGhlIG5leHQgbm9uIHdoaXRlc3BhY2UgcG9zXG4gICAgICB3aGlsZSAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgICAgaSsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMCwgbGVuID0gdGhpcy51aW50OEFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBsZXQgY2hyID0gdGhpcy51aW50OEFycmF5W2ldXG5cbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlICdOT1JNQUwnOlxuXG4gICAgICAgICAgc3dpdGNoIChjaHIpIHtcbiAgICAgICAgICAgIC8vIERRVU9URSBzdGFydHMgYSBuZXcgc3RyaW5nXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0RRVU9URTpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnc3RyaW5nJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NUUklORydcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBsaXN0XG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFRlRfUEFSRU5USEVTSVM6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0xJU1QnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gKSBjbG9zZXMgYSBsaXN0XG4gICAgICAgICAgICBjYXNlIEFTQ0lJX1JJR0hUX1BBUkVOVEhFU0lTOlxuICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS50eXBlICE9PSAnTElTVCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGlzdCB0ZXJtaW5hdG9yICkgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gXSBjbG9zZXMgc2VjdGlvbiBncm91cFxuICAgICAgICAgICAgY2FzZSBBU0NJSV9SSUdIVF9CUkFDS0VUOlxuICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS50eXBlICE9PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VjdGlvbiB0ZXJtaW5hdG9yIF0gYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyA8IHN0YXJ0cyBhIG5ldyBwYXJ0aWFsXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFU1NfVEhBTl9TSUdOOlxuICAgICAgICAgICAgICBpZiAodGhpcy51aW50OEFycmF5W2kgLSAxXSAhPT0gQVNDSUlfUklHSFRfQlJBQ0tFVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnUEFSVElBTCdcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIHsgc3RhcnRzIGEgbmV3IGxpdGVyYWxcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ0xJVEVSQUwnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gKCBzdGFydHMgYSBuZXcgc2VxdWVuY2VcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfQVNURVJJU0s6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIG5vcm1hbGx5IGEgc3BhY2Ugc2hvdWxkIG5ldmVyIG9jY3VyXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX1NQQUNFOlxuICAgICAgICAgICAgICAvLyBqdXN0IGlnbm9yZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBbIHN0YXJ0cyBzZWN0aW9uXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFRlRfQlJBQ0tFVDpcbiAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgdGhlICpmaXJzdCogZWxlbWVudCBhZnRlciByZXNwb25zZSBjb21tYW5kLCB0aGVuIHByb2Nlc3MgYXMgYSByZXNwb25zZSBhcmd1bWVudCBsaXN0XG4gICAgICAgICAgICAgIGlmIChbJ09LJywgJ05PJywgJ0JBRCcsICdCWUUnLCAnUFJFQVVUSCddLmluZGV4T2YodGhpcy5wYXJlbnQuY29tbWFuZC50b1VwcGVyQ2FzZSgpKSA+PSAwICYmIHRoaXMuY3VycmVudE5vZGUgPT09IHRoaXMudHJlZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFQ1RJT04nXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjIyMSBkZWZpbmVzIGEgcmVzcG9uc2UgY29kZSBSRUZFUlJBTCB3aG9zZSBwYXlsb2FkIGlzIGFuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjE5Mi9SRkM1MDkyIGltYXB1cmwgdGhhdCB3ZSB3aWxsIHRyeSB0byBwYXJzZSBhcyBhbiBBVE9NIGJ1dFxuICAgICAgICAgICAgICAgIC8vIGZhaWwgcXVpdGUgYmFkbHkgYXQgcGFyc2luZy4gIFNpbmNlIHRoZSBpbWFwdXJsIGlzIHN1Y2ggYSB1bmlxdWVcbiAgICAgICAgICAgICAgICAvLyAoYW5kIGNyYXp5KSB0ZXJtLCB3ZSBqdXN0IHNwZWNpYWxpemUgdGhhdCBjYXNlIGhlcmUuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkoaSArIDEsIGkgKyAxMCkpLnRvVXBwZXJDYXNlKCkgPT09ICdSRUZFUlJBTCAnKSB7XG4gICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdGhlIFJFRkVSUkFMIGF0b21cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMSlcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgKyA4XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpICsgMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyA5XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlVG9VcHBlckNhc2UgPSB0cnVlXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAgIC8vIGVhdCBhbGwgdGhlIHdheSB0aHJvdWdoIHRoZSBdIHRvIGJlIHRoZSAgSU1BUFVSTCB0b2tlbi5cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMTApXG4gICAgICAgICAgICAgICAgICAvLyBqdXN0IGNhbGwgdGhpcyBhbiBBVE9NLCBldmVuIHRob3VnaCBJTUFQVVJMIG1pZ2h0IGJlIG1vcmUgY29ycmVjdFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgICAvLyBqdW1wIGkgdG8gdGhlICddJ1xuICAgICAgICAgICAgICAgICAgaSA9IHRoaXMudWludDhBcnJheS5pbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQsIGkgKyAxMClcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gdGhpcy5jdXJyZW50Tm9kZS5zdGFydFBvcyAtIHRoaXMucG9zXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgLSB0aGlzLnBvcyArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICAgICAgLy8gY2xvc2Ugb3V0IHRoZSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIC8vIEFueSBBVE9NIHN1cHBvcnRlZCBjaGFyIHN0YXJ0cyBhIG5ldyBBdG9tIHNlcXVlbmNlLCBvdGhlcndpc2UgdGhyb3cgYW4gZXJyb3JcbiAgICAgICAgICAgICAgLy8gQWxsb3cgXFwgYXMgdGhlIGZpcnN0IGNoYXIgZm9yIGF0b20gdG8gc3VwcG9ydCBzeXN0ZW0gZmxhZ3NcbiAgICAgICAgICAgICAgLy8gQWxsb3cgJSB0byBzdXBwb3J0IExJU1QgJycgJVxuICAgICAgICAgICAgICBpZiAoIUlTX0FUT01fQ0hBUihjaHIpICYmIGNociAhPT0gQVNDSUlfQkFDS1NMQVNIICYmIGNociAhPT0gQVNDSUlfUEVSQ0VOVF9TSUdOKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ0FUT00nOlxuXG4gICAgICAgICAgLy8gc3BhY2UgZmluaXNoZXMgYW4gYXRvbVxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvL1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAoY2hyID09PSBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyAmJiB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUudHlwZSA9PT0gJ0xJU1QnKSB8fFxuICAgICAgICAgICAgICAoY2hyID09PSBBU0NJSV9SSUdIVF9CUkFDS0VUICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoKGNociA9PT0gQVNDSUlfQ09NTUEgfHwgY2hyID09PSBBU0NJSV9DT0xPTikgJiYgdGhpcy5jdXJyZW50Tm9kZS5pc051bWJlcigpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gWyBzdGFydHMgYSBzZWN0aW9uIGdyb3VwIGZvciB0aGlzIGVsZW1lbnRcbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9MRUZUX0JSQUNLRVQgJiYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdCT0RZJywgZmFsc2UpIHx8IHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdCT0RZLlBFRUsnLCBmYWxzZSkpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUsIHRoaXMucG9zICsgaSlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRUNUSU9OJ1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0xFU1NfVEhBTl9TSUdOKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc3RhcnQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gaWYgdGhlIGNoYXIgaXMgbm90IEFUT00gY29tcGF0aWJsZSwgdGhyb3cuIEFsbG93IFxcKiBhcyBhbiBleGNlcHRpb25cbiAgICAgICAgICBpZiAoIUlTX0FUT01fQ0hBUihjaHIpICYmIGNociAhPT0gQVNDSUlfUklHSFRfQlJBQ0tFVCAmJiAhKGNociA9PT0gQVNDSUlfQVNURVJJU0sgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ1xcXFwnKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcKicpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdTVFJJTkcnOlxuXG4gICAgICAgICAgLy8gRFFVT1RFIGVuZHMgdGhlIHN0cmluZyBzZXF1ZW5jZVxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0RRVU9URSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBcXCBFc2NhcGVzIHRoZSBmb2xsb3dpbmcgY2hhclxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0JBQ0tTTEFTSCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVNraXAucHVzaChpIC0gdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0KVxuICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICBpZiAoaSA+PSBsZW4pIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaHIgPSB0aGlzLnVpbnQ4QXJyYXlbaV1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvKiAvLyBza2lwIHRoaXMgY2hlY2ssIG90aGVyd2lzZSB0aGUgcGFyc2VyIG1pZ2h0IGV4cGxvZGUgb24gYmluYXJ5IGlucHV0XG4gICAgICAgICAgaWYgKFRFWFRfQ0hBUigpLmluZGV4T2YoY2hyKSA8IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgKi9cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfR1JFQVRFUl9USEFOX1NJR04pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9GVUxMX1NUT1AgJiYgKCF0aGlzLmN1cnJlbnROb2RlLmdldFZhbHVlTGVuZ3RoKCkgfHwgdGhpcy5jdXJyZW50Tm9kZS5jb250YWluc0NoYXIoJy4nKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBwYXJ0aWFsIHNlcGFyYXRvciAuIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIUlTX0RJR0lUKGNocikgJiYgY2hyICE9PSBBU0NJSV9GVUxMX1NUT1ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyICE9PSBBU0NJSV9GVUxMX1NUT1AgJiYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCcwJykgfHwgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnLjAnLCAtMikpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdMSVRFUkFMJzpcbiAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5zdGFydGVkKSB7XG4gICAgICAgICAgICBpZiAoY2hyID09PSAwKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBcXFxceDAwIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpID49IHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX1BMVVMgJiYgdGhpcy5vcHRpb25zLmxpdGVyYWxQbHVzKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxQbHVzID0gdHJ1ZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VUKSB7XG4gICAgICAgICAgICBpZiAoISgnbGl0ZXJhbExlbmd0aCcgaW4gdGhpcy5jdXJyZW50Tm9kZSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGxpdGVyYWwgcHJlZml4IGVuZCBjaGFyIH0gYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX05MKSB7XG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnVpbnQ4QXJyYXlbaSArIDFdID09PSBBU0NJSV9DUiAmJiB0aGlzLnVpbnQ4QXJyYXlbaSArIDJdID09PSBBU0NJSV9OTCkge1xuICAgICAgICAgICAgICBpICs9IDJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGkgKyAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSBOdW1iZXIodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoKVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5zdGFydGVkID0gdHJ1ZVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugd2hlcmUgbGl0ZXJhbCBjb250ZW50IGxlbmd0aCBpcyAwXG4gICAgICAgICAgICAgIC8vIGNsb3NlIHRoZSBub2RlIHJpZ2h0IGF3YXksIGRvIG5vdCB3YWl0IGZvciBhZGRpdGlvbmFsIGlucHV0XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghSVNfRElHSVQoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID09PSAnMCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXRlcmFsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID0gKHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCB8fCAnJykgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNocilcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ1NFUVVFTkNFJzpcbiAgICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyB0aGUgc2VxdWVuY2Ugc2V0XG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTIpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgY2hyID09PSBBU0NJSV9SSUdIVF9CUkFDS0VUICYmXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUudHlwZSA9PT0gJ1NFQ1RJT04nKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9DT0xPTikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09IEFTQ0lJX0FTVEVSSVNLKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJywnLCAtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJzonLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHJhbmdlIHdpbGRjYXJkIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gQVNDSUlfQ09NTUEpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJzonLCAtMikpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHNlcXVlbmNlIHNlcGFyYXRvciAsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKCFJU19ESUdJVChjaHIpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKElTX0RJR0lUKGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoSVNfQ09NTUFORClcbiAgfVxuXG4gIGlmICghaXNFbXB0eShwYXJzZXIucmVtYWluZGVyKSkge1xuICAgIHBhcnNlci5nZXRTcGFjZSgpXG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IHBhcnNlci5nZXRBdHRyaWJ1dGVzKClcbiAgfVxuXG4gIGlmIChwYXJzZXIuaHVtYW5SZWFkYWJsZSkge1xuICAgIHJlc3BvbnNlLmF0dHJpYnV0ZXMgPSAocmVzcG9uc2UuYXR0cmlidXRlcyB8fCBbXSkuY29uY2F0KHtcbiAgICAgIHR5cGU6ICdURVhUJyxcbiAgICAgIHZhbHVlOiBwYXJzZXIuaHVtYW5SZWFkYWJsZVxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gcmVzcG9uc2Vcbn1cbiJdfQ==