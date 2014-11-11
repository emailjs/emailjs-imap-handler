(function(root, factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        define(['chai', 'imap-handler', './fixtures/mimetorture'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('../src/imap-handler'), require('./fixtures/mimetorture'));
    }
}(this, function(chai, imapHandler, mimetorture) {
    "use strict";

    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe("IMAP Command Parser", function() {
        describe('get tag', function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD").tag).to.equal("TAG1");
            });

            it("should fail for unexpected WS", function() {
                expect(function() {
                    imapHandler.parser(" TAG CMD");
                }).to.throw(Error);
            });

            it("should * OK ", function() {
                expect(function() {
                    imapHandler.parser(" TAG CMD");
                }).to.throw(Error);
            });

            it("should + OK ", function() {
                expect(imapHandler.parser("+ TAG CMD").tag).to.equal("+");
            });

            it("should allow untagged", function() {
                expect(function() {
                    imapHandler.parser("* CMD");
                }).to.not.throw(Error);
            });

            it("should fail for empty tag", function() {
                expect(function() {
                    imapHandler.parser("");
                }).to.throw(Error);
            });

            it("should fail for unexpected end", function() {
                expect(function() {
                    imapHandler.parser("TAG1");
                }).to.throw(Error);
            });

            it("should fail for invalid char", function() {
                expect(function() {
                    imapHandler.parser("TAG\"1 CMD");
                }).to.throw(Error);
            });
        });

        describe("get arguments", function() {
            it("should allow trailing whitespace and empty arguments", function() {
                expect(function() {
                    imapHandler.parser("* SEARCH ");
                }).to.not.throw(Error);
            });
        });

        describe("get command", function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD").command).to.equal("CMD");
            });

            it("should work for multi word command", function() {
                expect(imapHandler.parser("TAG1 UID FETCH").command).to.equal("UID FETCH");
            });

            it("should fail for unexpected WS", function() {
                expect(function() {
                    imapHandler.parser("TAG1  CMD");
                }).to.throw(Error);
            });

            it("should fail for empty command", function() {
                expect(function() {
                    imapHandler.parser("TAG1 ");
                }).to.throw(Error);
            });

            it("should fail for invalid char", function() {
                expect(function() {
                    imapHandler.parser("TAG1 CM=D");
                }).to.throw(Error);
            });
        });

        describe("get attribute", function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD FED").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "FED"
                }]);
            });

            it("should succeed for single whitespace between values", function() {
                expect(imapHandler.parser("TAG1 CMD FED TED").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "FED"
                }, {
                    type: "ATOM",
                    value: "TED"
                }]);
            });

            it("should succeed for ATOM", function() {
                expect(imapHandler.parser("TAG1 CMD ABCDE").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "ABCDE"
                }]);

                expect(imapHandler.parser("TAG1 CMD ABCDE DEFGH").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "ABCDE"
                }, {
                    type: "ATOM",
                    value: "DEFGH"
                }]);

                expect(imapHandler.parser("TAG1 CMD %").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "%"
                }]);

                expect(imapHandler.parser("TAG1 CMD \\*").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "\\*"
                }]);

                expect(imapHandler.parser("12.82 STATUS [Gmail].Trash (UIDNEXT UNSEEN HIGHESTMODSEQ)").attributes).to.deep.equal([{
                        type: 'ATOM',
                        value: '[Gmail].Trash'
                    },
                    [{
                        type: 'ATOM',
                        value: 'UIDNEXT'
                    }, {
                        type: 'ATOM',
                        value: 'UNSEEN'
                    }, {
                        type: 'ATOM',
                        value: 'HIGHESTMODSEQ'
                    }]
                ]);
            });

            it("should not succeed for ATOM", function() {
                expect(function() {
                    imapHandler.parser("TAG1 CMD \\*a");
                }).to.throw(Error);
            });
        });

        describe('get string', function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD \"ABCDE\"").attributes).to.deep.equal([{
                    type: "STRING",
                    value: "ABCDE"
                }]);

                expect(imapHandler.parser("TAG1 CMD \"ABCDE\" \"DEFGH\"").attributes).to.deep.equal([{
                    type: "STRING",
                    value: "ABCDE"
                }, {
                    type: "STRING",
                    value: "DEFGH"
                }]);
            });
        });

        describe('get list', function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD (1234)").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }]
                ]);
                expect(imapHandler.parser("TAG1 CMD (1234 TERE)").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }, {
                        type: "ATOM",
                        value: "TERE"
                    }]
                ]);
                expect(imapHandler.parser("TAG1 CMD (1234)(TERE)").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }],
                    [{
                        type: "ATOM",
                        value: "TERE"
                    }]
                ]);
                expect(imapHandler.parser("TAG1 CMD ( 1234)").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }]
                ]);
                // Trailing whitespace in a BODYSTRUCTURE atom list has been
                // observed on yahoo.co.jp's
                expect(imapHandler.parser("TAG1 CMD (1234 )").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }]
                ]);
                expect(imapHandler.parser("TAG1 CMD (1234) ").attributes).to.deep.equal([
                    [{
                        type: "ATOM",
                        value: "1234"
                    }]
                ]);
            });
        });

        describe('nested list', function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD (((TERE)) VANA)").attributes).to.deep.equal([
                    [
                        [
                            [{
                                type: "ATOM",
                                value: "TERE"
                            }]
                        ], {
                            type: "ATOM",
                            value: "VANA"
                        }
                    ]
                ]);
                expect(imapHandler.parser("TAG1 CMD (( (TERE)) VANA)").attributes).to.deep.equal([
                    [
                        [
                            [{
                                type: "ATOM",
                                value: "TERE"
                            }]
                        ], {
                            type: "ATOM",
                            value: "VANA"
                        }
                    ]
                ]);
                expect(imapHandler.parser("TAG1 CMD (((TERE) ) VANA)").attributes).to.deep.equal([
                    [
                        [
                            [{
                                type: "ATOM",
                                value: "TERE"
                            }]
                        ], {
                            type: "ATOM",
                            value: "VANA"
                        }
                    ]
                ]);
            });
        });

        describe("get literal", function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD {4}\r\nabcd").attributes).to.deep.equal([{
                    type: "LITERAL",
                    value: "abcd"
                }]);

                expect(imapHandler.parser("TAG1 CMD {4}\r\nabcd {4}\r\nkere").attributes).to.deep.equal([{
                    type: "LITERAL",
                    value: "abcd"
                }, {
                    type: "LITERAL",
                    value: "kere"
                }]);

                expect(imapHandler.parser("TAG1 CMD ({4}\r\nabcd {4}\r\nkere)").attributes).to.deep.equal([
                    [{
                        type: "LITERAL",
                        value: "abcd"
                    }, {
                        type: "LITERAL",
                        value: "kere"
                    }]
                ]);
            });

            it("should fail", function() {
                expect(function() {
                    imapHandler.parser("TAG1 CMD {4}\r\nabcd{4}  \r\nkere");
                }).to.throw(Error);
            });

            it('should allow zero length literal in the end of a list', function() {
                expect(imapHandler.parser("TAG1 CMD ({0}\r\n)").attributes).to.deep.equal([
                    [{
                        type: "LITERAL",
                        value: ""
                    }]
                ]);
            });

        });

        describe("ATOM Section", function() {
            it("should succeed", function() {
                expect(imapHandler.parser("TAG1 CMD BODY[]").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: []
                }]);
                expect(imapHandler.parser("TAG1 CMD BODY[(KERE)]").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: [
                        [{
                            type: "ATOM",
                            value: "KERE"
                        }]
                    ]
                }]);
            });
            it("will not fail due to trailing whitespace", function() {
                // We intentionally have trailing whitespace in the section here
                // because we altered the parser to handle this when we made it
                // legal for lists and it makes sense to accordingly test it.
                // However, we have no recorded incidences of this happening in
                // reality (unlike for lists).
                expect(imapHandler.parser("TAG1 CMD BODY[HEADER.FIELDS (Subject From) ]").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: [
                        {
                            type: 'ATOM',
                            value: 'HEADER.FIELDS'
                        },
                        [{
                            type: "ATOM",
                            value: "Subject"
                        }, {
                            type: "ATOM",
                            value: "From"
                        }]
                    ]
                }]);
            });
            it("should fail where default BODY and BODY.PEEK are allowed to have sections", function() {});
            expect(function() {
                imapHandler.parser("TAG1 CMD KODY[]");
            }).to.throw(Error);
        });

        describe("Human readable", function() {
            it('should succeed', function() {
                expect(imapHandler.parser("* OK [CAPABILITY IDLE] Hello world!")).to.deep.equal({
                    command: "OK",
                    tag: "*",
                    attributes: [{
                        section: [{
                            type: "ATOM",
                            value: "CAPABILITY"
                        }, {
                            type: "ATOM",
                            value: "IDLE"
                        }],
                        type: "ATOM",
                        value: ""
                    }, {
                        type: "TEXT",
                        value: "Hello world!"
                    }]
                });

                expect(imapHandler.parser("* OK Hello world!")).to.deep.equal({
                    command: "OK",
                    tag: "*",
                    attributes: [{
                        type: "TEXT",
                        value: "Hello world!"
                    }]
                });

                expect(imapHandler.parser("* OK")).to.deep.equal({
                    command: "OK",
                    tag: "*"
                });

                expect(imapHandler.parser("* OK [PERMANENTFLAGS (de:hacking $label kt-evalution [css3-page] \\*)] Flags permitted.")).to.deep.equal({
                    tag: '*',
                    command: 'OK',
                    attributes: [{
                        type: 'ATOM',
                        value: '',
                        section: [{
                                type: 'ATOM',
                                value: 'PERMANENTFLAGS'
                            },
                            [{
                                type: 'ATOM',
                                value: 'de:hacking'
                            }, {
                                type: 'ATOM',
                                value: '$label'
                            }, {
                                type: 'ATOM',
                                value: 'kt-evalution'
                            }, {
                                type: 'ATOM',
                                value: '[css3-page]'
                            }, {
                                type: 'ATOM',
                                value: '\\*'
                            }]
                        ]
                    }, {
                        type: 'TEXT',
                        value: 'Flags permitted.'
                    }]
                });
            });
        });

        describe("ATOM Partial", function() {
            it('should succeed', function() {
                expect(imapHandler.parser("TAG1 CMD BODY[]<0>").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: [],
                    partial: [0]
                }]);
                expect(imapHandler.parser("TAG1 CMD BODY[]<12.45>").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: [],
                    partial: [12, 45]
                }]);
                expect(imapHandler.parser("TAG1 CMD BODY[HEADER.FIELDS (Subject From)]<12.45>").attributes).to.deep.equal([{
                    type: "ATOM",
                    value: "BODY",
                    section: [{
                            type: 'ATOM',
                            value: 'HEADER.FIELDS'
                        },
                        [{
                            type: "ATOM",
                            value: "Subject"
                        }, {
                            type: "ATOM",
                            value: "From"
                        }]
                    ],
                    partial: [12, 45]
                }]);
            });

            it('should fail', function() {
                expect(function() {
                    imapHandler.parser("TAG1 CMD KODY<0.123>");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD BODY[]<123.0>");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD BODY[]<01>");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD BODY[]<0.01>");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD BODY[]<0.1.>");
                }).to.throw(Error);
            });
        });

        describe("SEQUENCE", function() {
            it('should succeed', function() {
                expect(imapHandler.parser("TAG1 CMD *:4,5:7 TEST").attributes).to.deep.equal([{
                    type: "SEQUENCE",
                    value: "*:4,5:7"
                }, {
                    type: "ATOM",
                    value: "TEST"
                }]);

                expect(imapHandler.parser("TAG1 CMD 1:* TEST").attributes).to.deep.equal([{
                    type: "SEQUENCE",
                    value: "1:*"
                }, {
                    type: "ATOM",
                    value: "TEST"
                }]);

                expect(imapHandler.parser("TAG1 CMD *:4 TEST").attributes).to.deep.equal([{
                    type: "SEQUENCE",
                    value: "*:4"
                }, {
                    type: "ATOM",
                    value: "TEST"
                }]);
            });

            it('should fail', function() {
                expect(function() {
                    imapHandler.parser("TAG1 CMD *:4,5:");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD *:4,5:TEST TEST");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD *:4,5: TEST");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD *4,5 TEST");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD *,5 TEST");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD 5,* TEST");
                }).to.throw(Error);

                expect(function() {
                    imapHandler.parser("TAG1 CMD 5, TEST");
                }).to.throw(Error);
            });
        });

        describe("Escaped quotes", function() {
            it('should succeed', function() {
                expect(imapHandler.parser('* 331 FETCH (ENVELOPE ("=?ISO-8859-1?Q?\\"G=FCnter__Hammerl\\"?="))').attributes).to.deep.equal([{
                        type: "ATOM",
                        value: "FETCH"
                    },
                    [{
                            type: "ATOM",
                            value: "ENVELOPE"
                        },
                        [{
                            type: "STRING",
                            value: "=?ISO-8859-1?Q?\"G=FCnter__Hammerl\"?="
                        }]
                    ]
                ]);
            });
        });

        describe('MimeTorture', function() {
            it('should parse mimetorture input', function() {
                var parsed;
                expect(function() {
                    parsed = imapHandler.parser(mimetorture.input);
                }).to.not.throw(Error);
                expect(parsed).to.deep.equal(mimetorture.output);
            });
        });
    });

}));