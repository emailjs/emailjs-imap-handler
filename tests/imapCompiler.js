/* jshint browser: true */
/* global define: false, test: false, equal: false */

define(['../imapHandler.js'], function(imapHandler){

    "use strict";

    module("IMAP Command Compiler");

    test("Test compiler", function(){
        var command = '* FETCH (ENVELOPE ("Mon, 2 Sep 2013 05:30:13 -0700 (PDT)" NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "tr.ee")) NIL NIL NIL "<-4730417346358914070@unknownmsgid>") BODYSTRUCTURE (("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 105 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "<test1>" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 5 NIL NIL NIL) ("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 83 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "NIL" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 4 NIL NIL NIL) ("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 19 0 NIL NIL NIL) "MIXED" ("BOUNDARY" "----mailcomposer-?=_1-1328088797399") NIL NIL))',
            parsed = imapHandler.parser(command,{
                allowUntagged: true
            }),
            compiled = imapHandler.compiler(parsed);

        equal(command, compiled);
    });

    module("IMAP Command Compiler, Types");

    test("No attributes", function(){
        var parsed = {
            tag: "*",
            command: "CMD"
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD", compiled);
    });

    test("TEXT", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "TEXT", value: "Tere tere!"}
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD Tere tere!", compiled);
    });

    test("SECTION", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "SECTION", section:[
                    {type: "ATOM", value: "ALERT"}
                ]}
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD [ALERT]", compiled);
    });

    test("ATOM", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "ATOM", value: "ALERT"},
                {type: "ATOM", value: "\\ALERT"},
                {type: "ATOM", value: "NO ALERT"}
            ]
        };
        var compiled = imapHandler.compiler(parsed);
        equal("* CMD ALERT \\ALERT \"NO ALERT\"", compiled);
    });

    test("SEQUENCE", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "SEQUENCE", value: "*:4,5,6"}
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD *:4,5,6", compiled);
    });

    test("NIL", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                null,
                null
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD NIL NIL", compiled);
    });

    test("TEXT", function(){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "String", value: "Tere tere!"},
                "Vana kere"
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* CMD \"Tere tere!\" \"Vana kere\"", compiled);
    });

    test("No Command", function(){
        var parsed = {
            tag: "*",
            attributes: [
                1,
                {type:"ATOM", value: "EXPUNGE"}
            ]
        };
        var compiled = imapHandler.compiler(parsed);

        equal("* 1 EXPUNGE", compiled);
    });

});