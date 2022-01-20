//
//  ExampleSwiftFile.swift
//  Sample
//
//  Created by Cara Hurtle on 1/19/22.
//  Copyright © 2022 Facebook. All rights reserved.
//

import Foundation

class ExampleSwiftFile : NSObject {
    var theValue: String
    @objc init(aTestValue: String) {
        theValue = aTestValue
    }
}
