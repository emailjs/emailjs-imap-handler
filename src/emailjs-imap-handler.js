// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// UMD shim, see: https://github.com/umdjs/umd/blob/master/returnExports.js
(function(root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['./emailjs-imap-parser', './emailjs-imap-compiler'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('./emailjs-imap-parser'), require('./emailjs-imap-compiler'));
    } else {
        root['emailjs-imap-handler'] = factory(root['emailjs-imap-parser'], root['emailjs-imap-compiler']);
    }
}(this, function(imapParser, imapCompiler) {

    'use strict';

    return {
        parser: imapParser,
        compiler: imapCompiler
    };
}));
