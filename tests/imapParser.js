/* jshint browser: true */
/* global imapHandler: false, expect: false, test: false, ok: false, deepEqual: false, equal: false */

module("IMAP Command Parser, TAG");

test("Get tag success", function() {
    "use strict";

    try{
        equal(imapHandler.parser("TAG1 CMD").tag, "TAG1");
    }catch(E){
        ok(!E);
    }
});

test("Get tag fail (unexpected WS)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser(" TAG CMD");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("* OK ", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser(" TAG CMD");
        ok(false);
    }catch(E){
        ok(E);
    }
});


test("Get tag fsuccess (allow untagged)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("* CMD");
        ok(true);
    }catch(E){
        ok(!E);
    }
});

test("Get tag fail (empty tag)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get tag fail (unexpected end)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("TAG1");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get tag fail (invalid char)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("TAG+1 CMD");
        ok(false);
    }catch(E){
        ok(E);
    }
});

module("IMAP Command Parser, COMMAND");

test("Get command success", function() {
    "use strict";

    try{
        equal(imapHandler.parser("TAG1 CMD").command, "CMD");
    }catch(E){
        ok(!E);
    }
});

test("Get command fail (unexpected WS)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("TAG1  CMD");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get command fail (empty command)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("TAG1 ");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get command fail (invalid char)", function() {
    "use strict";

    expect(1);
    try{
        imapHandler.parser("TAG1 CM=D");
        ok(false);
    }catch(E){
        ok(E);
    }
});
test("Get multi word command", function() {
    "use strict";

    try{
        equal(imapHandler.parser("TAG1 UID FETCH").command, "UID FETCH");
    }catch(E){
        ok(!E);
    }

});

module("IMAP Command Parser, ATTRIBUTE");

test("Get attribute success", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD FED").attributes, [{type:"ATOM", value:"FED"}]);
        ok(true);
    }catch(E){
        ok(!E);
    }
});

test("Get attribute fail (invalid whitespace at end)", function() {
    "use strict";

    try{
        imapHandler.parser("TAG1 CMD FED ");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get attribute fail (invalid whitespace between value)", function() {
    "use strict";

    try{
        imapHandler.parser("TAG1 CMD FED  TED");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Get attribute success (single whitespace between values)", function() {
    "use strict";

    try{
        deepEqual(
            imapHandler.parser("TAG1 CMD FED TED").attributes,
            [{type:"ATOM", value:"FED"}, {type:"ATOM", value:"TED"}]
        );
        ok(true);
    }catch(E){
        ok(!E);
    }
});

test("ATOM", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD ABCDE").attributes, [{type:"ATOM", value:"ABCDE"}]);
        deepEqual(imapHandler.parser("TAG1 CMD ABCDE DEFGH").attributes, [{type:"ATOM", value:"ABCDE"}, {type:"ATOM", value:"DEFGH"}]);
        deepEqual(imapHandler.parser("TAG1 CMD %").attributes, [{type:"ATOM", value:"%"}]);
        deepEqual(imapHandler.parser("TAG1 CMD \\*").attributes, [{type:"ATOM", value:"\\*"}]);
        deepEqual(
            imapHandler.parser("12.82 STATUS [Gmail].Trash (UIDNEXT UNSEEN HIGHESTMODSEQ)").attributes,
            [
                {type: 'ATOM', value: '[Gmail].Trash'},
                [
                    { type: 'ATOM', value: 'UIDNEXT'},
                    { type: 'ATOM', value: 'UNSEEN'},
                    { type: 'ATOM', value: 'HIGHESTMODSEQ'}
                ]
            ]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        imapHandler.parser("TAG1 CMD \\*a");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("STRING", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD \"ABCDE\"").attributes, [{type:"STRING", value:"ABCDE"}]);
        deepEqual(imapHandler.parser("TAG1 CMD \"ABCDE\" \"DEFGH\"").attributes, [{type:"STRING", value:"ABCDE"}, {type:"STRING", value:"DEFGH"}]);
        ok(true);
    }catch(E){
        ok(!E);
    }
});

test("LIST", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD (1234)").attributes, [[{type:"ATOM", value: "1234"}]]);
        deepEqual(imapHandler.parser("TAG1 CMD (1234 TERE)").attributes, [[{type:"ATOM", value: "1234"}, {type:"ATOM", value: "TERE"}]]);
        ok(true);
    }catch(E){
        ok(!E);
    }
    try{
        imapHandler.parser("TAG1 CMD (1234 )");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD ( 1234)");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD (1234) ");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Nested LIST", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD (((TERE)) VANA)").attributes, [[[[{type: "ATOM", value: "TERE"}]], {type: "ATOM", value: "VANA"}]]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        imapHandler.parser("TAG1 CMD (( (TERE)) VANA)");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("LITERAL", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD {4}\r\nabcd").attributes, [{type: "LITERAL", value: "abcd"}]);
        deepEqual(imapHandler.parser("TAG1 CMD {4}\r\nabcd {4}\r\nkere").attributes, [{type: "LITERAL", value: "abcd"}, {type: "LITERAL", value: "kere"}]);
        deepEqual(imapHandler.parser("TAG1 CMD ({4}\r\nabcd {4}\r\nkere)").attributes, [[{type: "LITERAL", value: "abcd"}, {type: "LITERAL", value: "kere"}]]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        imapHandler.parser("TAG1 CMD {4}\r\nabcd{4}\r\nkere");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD {4}\r\nabcd{4}  \r\nkere");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("ATOM Section", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD BODY[]").attributes, [{type:"ATOM", value:"BODY", section: []}]);
        deepEqual(imapHandler.parser("TAG1 CMD BODY[(KERE)]").attributes, [{type:"ATOM", value:"BODY", section: [[{type: "ATOM", value:"KERE"}]]}]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        // By default BODY and BODY.PEEK are allowed to have sections
        imapHandler.parser("TAG1 CMD KODY[]");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("Human readable", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("* OK [CAPABILITY IDLE] Hello world!"),
            {
                command: "OK",
                tag: "*",
                attributes: [
                    {
                        section: [
                            {
                                type: "ATOM",
                                value: "CAPABILITY"
                            },
                            {
                                type: "ATOM",
                                value: "IDLE"
                            }
                        ],
                        type: "ATOM",
                        value: ""
                    },
                    {
                        type: "TEXT",
                        value: "Hello world!"
                    }
                ]
            });
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        deepEqual(imapHandler.parser("* OK Hello world!"),
            {
                command: "OK",
                tag: "*",
                attributes: [{type: "TEXT", value: "Hello world!"}]
            });
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        deepEqual(imapHandler.parser("* OK"),
            {
                command: "OK",
                tag: "*"
            });
        ok(true);
    }catch(E){
        ok(!E);
    }
});

test("ATOM Partial", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD BODY[]<0>").attributes, [{type:"ATOM", value:"BODY", section:[], partial: [0]}]);
        deepEqual(imapHandler.parser("TAG1 CMD BODY[]<12.45>").attributes, [{type:"ATOM", value:"BODY", section:[], partial: [12, 45]}]);
        deepEqual(
            imapHandler.parser("TAG1 CMD BODY[HEADER.FIELDS (Subject From)]<12.45>").attributes,
            [
                {
                    type:"ATOM",
                    value:"BODY",
                    section:
                    [
                        { type: 'ATOM', value: 'HEADER.FIELDS'},
                        [
                            {type: "ATOM", value: "Subject"},
                            {type: "ATOM", value: "From"}
                        ]
                    ],
                    partial: [12, 45]
                }
            ]);

        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        imapHandler.parser("TAG1 CMD KODY<0.123>");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD BODY[]<123.0>");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD BODY[]<01>");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD BODY[]<0.01>");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD BODY[]<0.1.>");
        ok(false);
    }catch(E){
        ok(E);
    }
});

test("SEQUENCE", function() {
    "use strict";

    try{
        deepEqual(imapHandler.parser("TAG1 CMD *:4,5:7 TEST").attributes, [{type:"SEQUENCE", value:"*:4,5:7"}, {type:"ATOM", value:"TEST"}]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        deepEqual(imapHandler.parser("TAG1 CMD 1:* TEST").attributes, [{type:"SEQUENCE", value:"1:*"}, {type:"ATOM", value:"TEST"}]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        deepEqual(imapHandler.parser("TAG1 CMD *:4 TEST").attributes, [{type:"SEQUENCE", value:"*:4"}, {type:"ATOM", value:"TEST"}]);
        ok(true);
    }catch(E){
        ok(!E);
    }

    try{
        imapHandler.parser("TAG1 CMD *:4,5:");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD *:4,5:TEST TEST");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD *:4,5: TEST");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD *4,5 TEST");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD *,5 TEST");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD 5,* TEST");
        ok(false);
    }catch(E){
        ok(E);
    }

    try{
        imapHandler.parser("TAG1 CMD 5, TEST");
        ok(false);
    }catch(E){
        ok(E);
    }
});
